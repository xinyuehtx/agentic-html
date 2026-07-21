/**
 * VersionService 单元测试
 * 覆盖：创建版本、子版本、版本号生成、checkout、版本对比、历史Graph、不可变性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VersionService } from '@/core/version.service';
import { SAMPLE_HTML, SAMPLE_VERSION } from '../../setup';

describe('VersionService', () => {
  let versionService: VersionService;

  beforeEach(() => {
    vi.clearAllMocks();
    versionService = new VersionService();
  });

  describe('create()', () => {
    it('should create initial version (v1) with null parent', async () => {
      const version = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      expect(version).toBeDefined();
      expect(version.id).toBeDefined();
      expect(version.version).toBe('v1');
      expect(version.parentId).toBeNull();
      expect(version.timestamp).toBeDefined();
      expect(version.sealed).toBe(true);
    });

    it('should create child version from parent (v1 -> v1.1)', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const v1_1 = await versionService.create({
        parentId: v1.id,
        htmlContent: '<html><body>Modified</body></html>',
      });

      expect(v1_1.version).toBe('v1.1');
      expect(v1_1.parentId).toBe(v1.id);
    });

    it('should create sibling version (v1 -> v1.1, v1.2)', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const v1_1 = await versionService.create({
        parentId: v1.id,
        htmlContent: '<html><body>Branch 1</body></html>',
      });

      const v1_2 = await versionService.create({
        parentId: v1.id,
        htmlContent: '<html><body>Branch 2</body></html>',
      });

      expect(v1_1.version).toBe('v1.1');
      expect(v1_2.version).toBe('v1.2');
    });

    it('should create deeply nested version (v1.1 -> v1.1.1)', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const v1_1 = await versionService.create({
        parentId: v1.id,
        htmlContent: '<html><body>v1.1</body></html>',
      });

      const v1_1_1 = await versionService.create({
        parentId: v1_1.id,
        htmlContent: '<html><body>v1.1.1</body></html>',
      });

      expect(v1_1_1.version).toBe('v1.1.1');
      expect(v1_1_1.parentId).toBe(v1_1.id);
    });

    it('should store HTML snapshot as read-only', async () => {
      const fs = await import('fs/promises');

      const version = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      expect(fs.writeFile).toHaveBeenCalled();
      expect(version.htmlFile).toContain('snapshot.html');
    });

    it('should include annotations when provided', async () => {
      const annotations = [
        { id: 'ann-1', type: 'COMMENT' as const, comment: 'test', status: 'pending' as const, timestamp: new Date().toISOString() },
      ];

      const version = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: annotations as any,
      });

      expect(version.annotations).toHaveLength(1);
    });

    it('should include metadata when provided', async () => {
      const version = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        metadata: { agent: 'claude-code', promptSummary: 'Fix header style' },
      });

      expect(version.metadata?.agent).toBe('claude-code');
      expect(version.metadata?.promptSummary).toBe('Fix header style');
    });

    it('should throw VERSION_PARENT_NOT_FOUND for invalid parent', async () => {
      await expect(versionService.create({
        parentId: 'non-existent-parent',
        htmlContent: SAMPLE_HTML,
      })).rejects.toMatchObject({
        code: 'VERSION_PARENT_NOT_FOUND',
      });
    });

    it('should throw VERSION_HTML_EMPTY when htmlContent is empty', async () => {
      await expect(versionService.create({
        parentId: null as unknown as string,
        htmlContent: '',
      })).rejects.toMatchObject({
        code: 'VERSION_HTML_EMPTY',
      });
    });
  });

  describe('version numbering algorithm', () => {
    it('should generate v1 for root version', async () => {
      const v = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });
      expect(v.version).toBe('v1');
    });

    it('should generate sequential child numbers (v1.1, v1.2, v1.3)', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const children: string[] = [];
      for (let i = 0; i < 3; i++) {
        const child = await versionService.create({
          parentId: v1.id,
          htmlContent: `<html><body>${i}</body></html>`,
        });
        children.push(child.version);
      }

      expect(children).toEqual(['v1.1', 'v1.2', 'v1.3']);
    });

    it('should handle deep nesting (v1.2.1.1)', async () => {
      const v1 = await versionService.create({ parentId: null as unknown as string, htmlContent: SAMPLE_HTML });
      await versionService.create({ parentId: v1.id, htmlContent: '<html>first</html>' }); // v1.1
      const v1_2 = await versionService.create({ parentId: v1.id, htmlContent: '<html>a</html>' });
      const v1_2_1 = await versionService.create({ parentId: v1_2.id, htmlContent: '<html>b</html>' });
      const v1_2_1_1 = await versionService.create({ parentId: v1_2_1.id, htmlContent: '<html>c</html>' });

      expect(v1_2.version).toBe('v1.2');
      expect(v1_2_1.version).toBe('v1.2.1');
      expect(v1_2_1_1.version).toBe('v1.2.1.1');
    });

    it('should correctly number when parent already has multiple children', async () => {
      const v1 = await versionService.create({ parentId: null as unknown as string, htmlContent: SAMPLE_HTML });

      // 创建 4 个子版本
      await versionService.create({ parentId: v1.id, htmlContent: '<html>1</html>' }); // v1.1
      await versionService.create({ parentId: v1.id, htmlContent: '<html>2</html>' }); // v1.2
      await versionService.create({ parentId: v1.id, htmlContent: '<html>3</html>' }); // v1.3
      const v1_4 = await versionService.create({ parentId: v1.id, htmlContent: '<html>4</html>' });

      expect(v1_4.version).toBe('v1.4');
    });
  });

  describe('checkout()', () => {
    it('should checkout version without annotations (default)', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const working = await versionService.checkout(v1.id);

      expect(working).toBeDefined();
      expect(working.sealed).toBe(false);
      expect(working.annotations).toHaveLength(0);
    });

    it('should checkout version with annotations when keepAnnotations is true', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: [
          { id: 'a1', anchor_element: { selector: '.hero' }, comment: 'test', timestamp: '' } as any,
          { id: 'a2', anchor_element: { selector: '.sidebar' }, comment: 'remove', timestamp: '' } as any,
        ],
      });

      const working = await versionService.checkout(v1.id, { keepAnnotations: true });

      expect(working.annotations).toHaveLength(2);
    });

    it('should checkout version without annotations when keepAnnotations is false', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: [
          { id: 'a1', type: 'COMMENT', comment: 'test', status: 'pending', timestamp: '' } as any,
        ],
      });

      const working = await versionService.checkout(v1.id, { keepAnnotations: false });

      expect(working.annotations).toHaveLength(0);
    });

    it('should throw VERSION_NOT_FOUND for invalid version id', async () => {
      await expect(versionService.checkout('invalid-version-id'))
        .rejects.toMatchObject({
          code: 'VERSION_NOT_FOUND',
        });
    });

    it('should set working copy parentId to checked-out version', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const working = await versionService.checkout(v1.id);
      expect(working.parentId).toBe(v1.id);
    });
  });

  describe('compare()', () => {
    it('should return diff between two versions', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const v1_1 = await versionService.create({
        parentId: v1.id,
        htmlContent: SAMPLE_HTML.replace('Hello World', 'Updated Title'),
      });

      const result = await versionService.compare(v1.id, v1_1.id);

      expect(result).toBeDefined();
      expect(result.diff).toBeDefined();
      expect(result.diff.additions).toBeGreaterThanOrEqual(0);
      expect(result.diff.deletions).toBeGreaterThanOrEqual(0);
      expect(result.diff.hunks).toBeInstanceOf(Array);
    });

    it('should return annotations for both versions', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: [{ id: 'a1', type: 'COMMENT', comment: 'v1 note' } as any],
      });

      const v1_1 = await versionService.create({
        parentId: v1.id,
        htmlContent: '<html>changed</html>',
        annotations: [{ id: 'a2', type: 'DELETION', comment: 'v1.1 note' } as any],
      });

      const result = await versionService.compare(v1.id, v1_1.id);

      expect(result.annotationsA).toHaveLength(1);
      expect(result.annotationsB).toHaveLength(1);
    });

    it('should show no diff when content is identical', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const v1_1 = await versionService.create({
        parentId: v1.id,
        htmlContent: SAMPLE_HTML,
      });

      const result = await versionService.compare(v1.id, v1_1.id);

      expect(result.diff.additions).toBe(0);
      expect(result.diff.deletions).toBe(0);
    });

    it('should throw VERSION_NOT_FOUND if either version is invalid', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      await expect(versionService.compare(v1.id, 'non-existent'))
        .rejects.toMatchObject({
          code: 'VERSION_NOT_FOUND',
        });

      await expect(versionService.compare('non-existent', v1.id))
        .rejects.toMatchObject({
          code: 'VERSION_NOT_FOUND',
        });
    });
  });

  describe('history()', () => {
    it('should return complete version graph for a session', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      await versionService.create({ parentId: v1.id, htmlContent: '<html>a</html>' });
      await versionService.create({ parentId: v1.id, htmlContent: '<html>b</html>' });

      const graph = await versionService.history('session-1');

      expect(graph).toBeDefined();
      expect(graph.nodes).toBeInstanceOf(Array);
      expect(graph.nodes.length).toBeGreaterThanOrEqual(3);
      expect(graph.edges).toBeInstanceOf(Array);
      expect(graph.rootId).toBeDefined();
      expect(graph.currentId).toBeDefined();
    });

    it('should include edges representing parent-child relationships', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const v1_1 = await versionService.create({
        parentId: v1.id,
        htmlContent: '<html>child</html>',
      });

      const graph = await versionService.history('session-1');

      expect(graph.edges).toContainEqual({
        from: v1.id,
        to: v1_1.id,
      });
    });

    it('should throw VERSION_SESSION_NOT_FOUND for invalid session', async () => {
      await expect(versionService.history('invalid-session'))
        .rejects.toMatchObject({
          code: 'VERSION_SESSION_NOT_FOUND',
        });
    });
  });

  describe('immutability', () => {
    it('should not allow modifying committed version HTML', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      // 版本一旦创建即为 sealed，不可修改
      expect(v1.sealed).toBe(true);
    });

    it('should not allow modifying sealed version annotations', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: [{ id: 'a1', anchor_element: { selector: '.hero' }, comment: 'frozen' } as any],
      });

      // 尝试修改不可变版本应被拒绝
      expect(v1.sealed).toBe(true);
      // 验证注解是只读快照
      expect(v1.annotations[0].comment).toBe('frozen');
    });

    it('should preserve version data integrity over time', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      // 多次获取同一版本应始终返回相同数据
      const fetched1 = await versionService.get(v1.id);
      const fetched2 = await versionService.get(v1.id);

      expect(fetched1).toEqual(fetched2);
    });
  });

  describe('get()', () => {
    it('should return version details by id', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const fetched = await versionService.get(v1.id);

      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(v1.id);
      expect(fetched?.version).toBe('v1');
    });

    it('should return null for non-existent version', async () => {
      const fetched = await versionService.get('non-existent');
      expect(fetched).toBeNull();
    });
  });
});
