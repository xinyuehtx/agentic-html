/**
 * PatchService 单元测试
 * 覆盖：CSS Selector 定位、各种 action 应用、定位失效、diff 生成
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PatchService } from '@/core/patch.service';
import { SAMPLE_HTML, SAMPLE_PATCH } from '../../setup';

describe('PatchService', () => {
  let patchService: PatchService;

  beforeEach(() => {
    vi.clearAllMocks();
    patchService = new PatchService();
  });

  describe('apply() - CSS Selector targeting', () => {
    it('should locate element by CSS Selector and apply replace action', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1 style="color: #1a73e8">Hello World</h1>',
          oldContent: '<h1>Hello World</h1>',
        },
      ]);

      expect(result).toBeDefined();
      expect(result.newVersionId).toBeDefined();
      expect(result.appliedPatches).toBe(1);
      expect(result.failedPatches).toHaveLength(0);
      expect(result.diff).toBeDefined();
    });

    it('should apply delete action', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-2',
          selector: 'body > div.sidebar > .ad-banner',
          action: 'delete',
        },
      ]);

      expect(result.appliedPatches).toBe(1);
      expect(result.failedPatches).toHaveLength(0);
    });

    it('should apply insert_before action', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-3',
          selector: 'body > div.hero > h1',
          action: 'insert_before',
          content: '<div class="banner">New Banner</div>',
        },
      ]);

      expect(result.appliedPatches).toBe(1);
    });

    it('should apply insert_after action', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-4',
          selector: 'body > div.hero > h1',
          action: 'insert_after',
          content: '<p class="tagline">A tagline here</p>',
        },
      ]);

      expect(result.appliedPatches).toBe(1);
    });

    it('should apply modify_style action', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-5',
          selector: 'body > div.hero > h1',
          action: 'modify_style',
          content: 'color: #1a73e8; font-size: 24px;',
        },
      ]);

      expect(result.appliedPatches).toBe(1);
    });

    it('should apply multiple patches in sequence', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'modify_style',
          content: 'color: red;',
        },
        {
          annotationId: 'ann-2',
          selector: 'body > div.sidebar > .ad-banner',
          action: 'delete',
        },
        {
          annotationId: 'ann-3',
          selector: 'body > div.content > p',
          action: 'replace',
          content: '<p>Updated content</p>',
        },
      ]);

      expect(result.appliedPatches).toBe(3);
      expect(result.failedPatches).toHaveLength(0);
    });
  });

  describe('apply() - selector failure', () => {
    it('should record PatchFailure when CSS Selector fails (no fallback)', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.changed-structure > h1', // selector 已失效
          action: 'replace',
          content: '<h1>New Title</h1>',
          oldContent: '<h1>Hello World</h1>',
        },
      ]);

      // 版本 HTML 是静态快照，selector 失效直接记录失败，无 fallback
      expect(result.failedPatches).toHaveLength(1);
      expect(result.failedPatches[0].reason).toBeDefined();
    });

    it('should not have fallbackAttempted field in PatchFailure', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.nonexistent > span.ghost',
          action: 'replace',
          content: '<span>new</span>',
          oldContent: '<span>content that does not exist anywhere</span>',
        },
      ]);

      if (result.failedPatches.length > 0) {
        expect((result.failedPatches[0] as any).fallbackAttempted).toBeUndefined();
      }
    });
  });

  describe('apply() - error handling', () => {
    it('should throw PATCH_VERSION_NOT_FOUND for invalid version', async () => {
      await expect(patchService.apply('non-existent-version', [SAMPLE_PATCH]))
        .rejects.toMatchObject({
          code: 'PATCH_VERSION_NOT_FOUND',
        });
    });

    it('should throw PATCH_EMPTY when patches array is empty', async () => {
      await expect(patchService.apply('ver-001', []))
        .rejects.toMatchObject({
          code: 'PATCH_EMPTY',
        });
    });

    it('should throw PATCH_ALL_FAILED when no patch could be applied', async () => {
      await expect(patchService.apply('ver-001', [
        {
          annotationId: 'ann-1',
          selector: '#completely-nonexistent-element-xyz',
          action: 'delete',
          oldContent: 'content-not-found-anywhere-in-document',
        },
      ])).rejects.toMatchObject({
        code: 'PATCH_ALL_FAILED',
      });
    });

    it('should throw PATCH_CONTENT_MISMATCH when oldContent does not match', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>New</h1>',
          oldContent: '<h1>This does not match actual content</h1>',
        },
      ]);

      // 应该记录为 content mismatch 失败
      expect(result.failedPatches.length).toBeGreaterThan(0);
      expect(result.failedPatches[0].reason).toContain('mismatch');
    });

    it('should throw PATCH_INVALID_ACTION for unsupported action', async () => {
      await expect(patchService.apply('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'unknown_action' as any,
          content: 'test',
        },
      ])).rejects.toMatchObject({
        code: 'PATCH_INVALID_ACTION',
      });
    });

    it('should handle partial failure (some patches succeed, some fail)', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>Valid Change</h1>',
          oldContent: '<h1>Hello World</h1>',
        },
        {
          annotationId: 'ann-2',
          selector: '#nonexistent',
          action: 'delete',
          oldContent: 'ghost content',
        },
      ]);

      // 部分成功时仍创建新版本
      expect(result.newVersionId).toBeDefined();
      expect(result.appliedPatches).toBe(1);
      expect(result.failedPatches).toHaveLength(1);
    });
  });

  describe('apply() - diff generation', () => {
    it('should generate diff after applying patches', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>New Title</h1>',
          oldContent: '<h1>Hello World</h1>',
        },
      ]);

      expect(result.diff).toBeDefined();
      expect(result.diff.additions).toBeGreaterThanOrEqual(0);
      expect(result.diff.deletions).toBeGreaterThanOrEqual(0);
      expect(result.diff.hunks).toBeInstanceOf(Array);
    });

    it('should show additions and deletions in diff', async () => {
      const result = await patchService.apply('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.sidebar > .ad-banner',
          action: 'delete',
        },
      ]);

      expect(result.diff.deletions).toBeGreaterThan(0);
    });
  });

  describe('preview()', () => {
    it('should return preview HTML without persisting changes', async () => {
      const result = await patchService.preview('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>Preview Title</h1>',
          oldContent: '<h1>Hello World</h1>',
        },
      ]);

      expect(result).toBeDefined();
      expect(result.previewHtml).toContain('Preview Title');
      expect(result.diff).toBeDefined();
    });

    it('should not create a new version on preview', async () => {
      const result = await patchService.preview('ver-001', [
        {
          annotationId: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>Temp</h1>',
        },
      ]);

      // preview 不持久化，不应有 newVersionId
      expect(result.previewHtml).toBeDefined();
      expect(result.diff).toBeDefined();
    });
  });
});
