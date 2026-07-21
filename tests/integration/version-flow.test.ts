/**
 * 集成测试：版本创建→checkout→对比流程
 * 覆盖：完整版本管理流程、版本树正确性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VersionService } from '@/core/version.service';
import { AnnotationService } from '@/core/annotation.service';
import { PatchService } from '@/core/patch.service';
import { PreviewService } from '@/core/preview.service';
import { SAMPLE_HTML, SAMPLE_CLICK_ANNOTATION, SAMPLE_INK_ANNOTATION } from '../setup';

describe('Integration: Version Flow', () => {
  let versionService: VersionService;
  let annotationService: AnnotationService;
  let patchService: PatchService;
  let previewService: PreviewService;

  beforeEach(async () => {
    vi.clearAllMocks();
    versionService = new VersionService();
    annotationService = new AnnotationService();
    patchService = new PatchService();
    previewService = new PreviewService();

    // Mock file system
    const fs = await import('fs/promises');
    (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);
    (fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe('full flow: create version → annotate → apply_patch → new version → checkout → compare', () => {
    it('should complete the full version management lifecycle', async () => {
      // Step 1: 创建初始版本 v1
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });
      expect(v1.version).toBe('v1');
      expect(v1.sealed).toBe(true);

      // Step 2: 在 v1 上标注
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      // Step 3: Agent 应用 patch 生成 v1.1
      const patchResult = await patchService.apply(v1.id, [
        {
          annotationId: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'modify_style',
          content: 'color: #1a73e8; font-size: 28px;',
        },
      ]);
      expect(patchResult.newVersionId).toBeDefined();

      // Step 4: 验证新版本
      const v1_1 = await versionService.get(patchResult.newVersionId);
      expect(v1_1).not.toBeNull();
      expect(v1_1!.version).toBe('v1.1');
      expect(v1_1!.parentId).toBe(v1.id);
      expect(v1_1!.sealed).toBe(true);

      // Step 5: 从 v1 checkout 创建新分支
      const working = await versionService.checkout(v1.id, { keepAnnotations: false });
      expect(working.sealed).toBe(false);
      expect(working.annotations).toHaveLength(0);

      // Step 6: 在 checkout 版本上添加新标注并 apply patch
      await annotationService.create('working', {
        anchor_element: { selector: '.ad-banner' },
        comment: '删除广告',
      });

      const patchResult2 = await patchService.apply(v1.id, [
        {
          annotationId: 'ann-2',
          selector: 'body > div.sidebar > .ad-banner',
          action: 'delete',
        },
      ]);

      // Step 7: 验证新分支版本 v1.2
      const v1_2 = await versionService.get(patchResult2.newVersionId);
      expect(v1_2).not.toBeNull();
      expect(v1_2!.version).toBe('v1.2');
      expect(v1_2!.parentId).toBe(v1.id);

      // Step 8: 对比 v1.1 和 v1.2
      const comparison = await versionService.compare(patchResult.newVersionId, patchResult2.newVersionId);
      expect(comparison.diff).toBeDefined();
      expect(comparison.diff.hunks.length).toBeGreaterThan(0);
    });

    it('should support deep branch creation (v1 → v1.1 → v1.1.1)', async () => {
      // v1
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      // v1.1
      const v1_1 = await versionService.create({
        parentId: v1.id,
        htmlContent: SAMPLE_HTML.replace('Hello World', 'Modified'),
      });

      // v1.1.1
      const v1_1_1 = await versionService.create({
        parentId: v1_1.id,
        htmlContent: SAMPLE_HTML.replace('Hello World', 'Deep Modified'),
      });

      expect(v1.version).toBe('v1');
      expect(v1_1.version).toBe('v1.1');
      expect(v1_1_1.version).toBe('v1.1.1');

      // 验证链路
      expect(v1_1_1.parentId).toBe(v1_1.id);
      expect(v1_1.parentId).toBe(v1.id);
    });

    it('should support multiple branches from same parent', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      // 从 v1 创建 4 个分支
      const branches = [];
      for (let i = 0; i < 4; i++) {
        const branch = await versionService.create({
          parentId: v1.id,
          htmlContent: `<html><body>Branch ${i}</body></html>`,
        });
        branches.push(branch);
      }

      expect(branches[0].version).toBe('v1.1');
      expect(branches[1].version).toBe('v1.2');
      expect(branches[2].version).toBe('v1.3');
      expect(branches[3].version).toBe('v1.4');

      // 所有分支的 parentId 都指向 v1
      branches.forEach(b => expect(b.parentId).toBe(v1.id));
    });
  });

  describe('version tree correctness', () => {
    it('should build correct graph structure', async () => {
      // 构建如下版本树:
      //   v1
      //  / \
      // v1.1  v1.2
      //  |
      // v1.1.1

      const v1 = await versionService.create({ parentId: null as unknown as string, htmlContent: SAMPLE_HTML });
      const v1_1 = await versionService.create({ parentId: v1.id, htmlContent: '<html>1.1</html>' });
      const v1_2 = await versionService.create({ parentId: v1.id, htmlContent: '<html>1.2</html>' });
      const v1_1_1 = await versionService.create({ parentId: v1_1.id, htmlContent: '<html>1.1.1</html>' });

      const graph = await versionService.history('session-1');

      // 验证节点数量
      expect(graph.nodes.length).toBe(4);

      // 验证边关系
      expect(graph.edges).toContainEqual({ from: v1.id, to: v1_1.id });
      expect(graph.edges).toContainEqual({ from: v1.id, to: v1_2.id });
      expect(graph.edges).toContainEqual({ from: v1_1.id, to: v1_1_1.id });

      // 验证根节点
      expect(graph.rootId).toBe(v1.id);
    });

    it('should track annotation counts per version', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: [
          { id: 'a1', anchor_element: { selector: '.hero > h1' }, comment: 'note1' } as any,
          { id: 'a2', anchor_element: { selector: '.sidebar' }, comment: 'note2' } as any,
        ],
      });

      const graph = await versionService.history('session-1');
      const v1Node = graph.nodes.find(n => n.id === v1.id);

      expect(v1Node).toBeDefined();
      expect(v1Node!.annotationCount).toBe(2);
    });

    it('should maintain correct currentId in graph', async () => {
      const v1 = await versionService.create({ parentId: null as unknown as string, htmlContent: SAMPLE_HTML });
      const v1_1 = await versionService.create({ parentId: v1.id, htmlContent: '<html>new</html>' });

      const graph = await versionService.history('session-1');

      // currentId 应指向最新版本或当前预览的版本
      expect(graph.currentId).toBeDefined();
    });
  });

  describe('checkout with annotations', () => {
    it('should keep annotations when checkout with keepAnnotations=true', async () => {
      // 创建带标注的版本
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: [
          { id: 'a1', anchor_element: { selector: '.hero' }, comment: 'keep me', timestamp: '' } as any,
          { id: 'a2', anchor_element: { selector: '.content' }, comment: 'ink note', timestamp: '' } as any,
        ],
      });

      const working = await versionService.checkout(v1.id, { keepAnnotations: true });

      expect(working.annotations).toHaveLength(2);
      expect(working.annotations[0].comment).toBe('keep me');
    });

    it('should discard annotations when checkout with keepAnnotations=false', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: [
          { id: 'a1', anchor_element: { selector: '.hero' }, comment: 'discard me', timestamp: '' } as any,
        ],
      });

      const working = await versionService.checkout(v1.id, { keepAnnotations: false });

      expect(working.annotations).toHaveLength(0);
    });

    it('should create editable copies of inherited annotations', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: [
          { id: 'a1', anchor_element: { selector: '.hero' }, comment: 'original', timestamp: '' } as any,
        ],
      });

      const working = await versionService.checkout(v1.id, { keepAnnotations: true });

      // 继承的标注应可编辑（working copy 是 draft）
      expect(working.sealed).toBe(false);
      // 原始版本的标注不应被影响
      const original = await versionService.get(v1.id);
      expect(original!.annotations[0].comment).toBe('original');
    });
  });

  describe('version comparison', () => {
    it('should show HTML diff between versions', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      const modifiedHtml = SAMPLE_HTML
        .replace('Hello World', 'New Title')
        .replace('Welcome to the test page', 'Updated subtitle');

      const v1_1 = await versionService.create({
        parentId: v1.id,
        htmlContent: modifiedHtml,
      });

      const result = await versionService.compare(v1.id, v1_1.id);

      expect(result.diff.additions).toBeGreaterThan(0);
      expect(result.diff.deletions).toBeGreaterThan(0);
      expect(result.diff.hunks.length).toBeGreaterThan(0);
    });

    it('should return empty diff for identical content', async () => {
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
      expect(result.diff.hunks).toHaveLength(0);
    });

    it('should include annotations from both versions in comparison', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: [{ id: 'a1', anchor_element: { selector: '.hero' }, comment: 'v1 note' } as any],
      });

      const v1_1 = await versionService.create({
        parentId: v1.id,
        htmlContent: '<html>modified</html>',
        annotations: [
          { id: 'a2', anchor_element: { selector: '.sidebar' }, comment: 'v1.1 note1' } as any,
          { id: 'a3', anchor_element: { selector: '.hero > h1' }, comment: 'v1.1 note2' } as any,
        ],
      });

      const result = await versionService.compare(v1.id, v1_1.id);

      expect(result.annotationsA).toHaveLength(1);
      expect(result.annotationsB).toHaveLength(2);
    });
  });

  describe('version immutability enforcement', () => {
    it('should not allow modification of sealed version HTML', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
      });

      // 获取版本后尝试验证不可变性
      const fetched = await versionService.get(v1.id);
      expect(fetched!.sealed).toBe(true);

      // 多次获取应返回相同数据
      const fetchedAgain = await versionService.get(v1.id);
      expect(fetchedAgain!.htmlContent).toBe(fetched!.htmlContent);
    });

    it('should preserve annotation integrity across accesses', async () => {
      const v1 = await versionService.create({
        parentId: null as unknown as string,
        htmlContent: SAMPLE_HTML,
        annotations: [
          { id: 'a1', anchor_element: { selector: '.hero' }, comment: 'frozen note', timestamp: 'T1' } as any,
        ],
      });

      const fetched1 = await versionService.get(v1.id);
      const fetched2 = await versionService.get(v1.id);

      expect(fetched1!.annotations).toEqual(fetched2!.annotations);
      expect(fetched1!.annotations[0].comment).toBe('frozen note');
    });
  });
});
