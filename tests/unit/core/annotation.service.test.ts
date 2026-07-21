/**
 * AnnotationService 单元测试
 * 覆盖：创建标注（点选/圈画）、获取标注列表、更新评论、删除标注、导出、sealed 版本保护
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnotationService } from '@/core/annotation.service';
import {
  SAMPLE_CLICK_ANNOTATION,
  SAMPLE_INK_ANNOTATION,
  SAMPLE_DELETE_ANNOTATION,
  SAMPLE_MODIFY_ANNOTATION,
} from '../../setup';

describe('AnnotationService', () => {
  let annotationService: AnnotationService;

  beforeEach(() => {
    vi.clearAllMocks();
    annotationService = new AnnotationService();
  });

  describe('create() - click selection', () => {
    it('should create an annotation via click selection with anchor_element and comment', async () => {
      const annotation = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);

      expect(annotation).toBeDefined();
      expect(annotation.id).toBeDefined();
      expect(annotation.timestamp).toBeDefined();
      expect(annotation.anchor_element).toEqual(SAMPLE_CLICK_ANNOTATION.anchor_element);
      expect(annotation.comment).toBe(SAMPLE_CLICK_ANNOTATION.comment);
      expect(annotation.status).toBe('pending');
      expect(annotation.version_id).toBe('working');
      expect(annotation.screenshot).toBeUndefined();
      expect(annotation.hit_elements).toBeUndefined();
    });

    it('should auto-generate unique id for each annotation', async () => {
      const ann1 = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      const ann2 = await annotationService.create('working', SAMPLE_DELETE_ANNOTATION);

      expect(ann1.id).not.toBe(ann2.id);
    });

    it('should auto-set timestamp to current time', async () => {
      const before = new Date().toISOString();
      const annotation = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      const after = new Date().toISOString();

      expect(annotation.timestamp >= before).toBe(true);
      expect(annotation.timestamp <= after).toBe(true);
    });

    it('should reject creation on sealed version', async () => {
      await expect(annotationService.create('sealed-version-id', SAMPLE_CLICK_ANNOTATION))
        .rejects.toMatchObject({
          code: 'ANNOTATION_VERSION_SEALED',
        });
    });
  });

  describe('create() - ink drawing', () => {
    it('should create an annotation via ink drawing with screenshot and hit_elements', async () => {
      const annotation = await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      expect(annotation).toBeDefined();
      expect(annotation.id).toBeDefined();
      expect(annotation.timestamp).toBeDefined();
      expect(annotation.anchor_element).toEqual(SAMPLE_INK_ANNOTATION.anchor_element);
      expect(annotation.screenshot).toBe(SAMPLE_INK_ANNOTATION.screenshot);
      expect(annotation.hit_elements).toEqual(SAMPLE_INK_ANNOTATION.hit_elements);
      expect(annotation.comment).toBe(SAMPLE_INK_ANNOTATION.comment);
    });

    it('should store screenshot base64 data', async () => {
      const annotation = await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      expect(annotation.screenshot).toMatch(/^data:image\/png;base64,/);
    });

    it('should store anchor_element with DOMPosition fields', async () => {
      const annotation = await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      expect(annotation.anchor_element).toBeDefined();
      expect(annotation.anchor_element.selector).toBe('div.hero');
    });

    it('should store hit-test results with full element info', async () => {
      const annotation = await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      expect(annotation.hit_elements).toHaveLength(1);
      expect(annotation.hit_elements[0]).toEqual({
        selector: 'div.hero > h1',
        tag: 'H1',
        outerHtmlSummary: '<h1>Hello World</h1>',
        boundingRect: { x: 100, y: 50, width: 300, height: 40 },
      });
    });

    it('should NOT include ink_path field (ink path is not persisted)', async () => {
      const annotation = await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      expect((annotation as any).ink_path).toBeUndefined();
      expect((annotation as any).ink_bounds).toBeUndefined();
    });

    it('should fallback to body when no specific elements hit', async () => {
      const inkFallbackToBody = {
        ...SAMPLE_INK_ANNOTATION,
        anchor_element: { selector: 'body' },
        hit_elements: [
          {
            selector: 'body',
            tag: 'BODY',
            outerHtmlSummary: '<body>...</body>',
            boundingRect: { x: 0, y: 0, width: 1024, height: 768 },
          },
        ],
      };

      const annotation = await annotationService.create('working', inkFallbackToBody);
      expect(annotation.anchor_element.selector).toBe('body');
      expect(annotation.hit_elements).toHaveLength(1);
      expect(annotation.hit_elements![0].selector).toBe('body');
    });

    it('should handle multiple hit elements from ink annotation', async () => {
      const inkWithMultipleHits = {
        ...SAMPLE_INK_ANNOTATION,
        hit_elements: [
          {
            selector: 'div.hero > h1',
            tag: 'H1',
            outerHtmlSummary: '<h1>Hello World</h1>',
            boundingRect: { x: 100, y: 50, width: 300, height: 40 },
          },
          {
            selector: 'div.hero > p.subtitle',
            tag: 'P',
            outerHtmlSummary: '<p class="subtitle">Welcome to the test page</p>',
            boundingRect: { x: 100, y: 100, width: 300, height: 20 },
          },
        ],
      };

      const annotation = await annotationService.create('working', inkWithMultipleHits);
      expect(annotation.hit_elements).toHaveLength(2);
    });

    it('should set status to pending and version_id on ink annotation', async () => {
      const annotation = await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      expect(annotation.status).toBe('pending');
      expect(annotation.version_id).toBe('working');
    });
  });

  describe('getAll()', () => {
    it('should return all annotations for a version', async () => {
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      await annotationService.create('working', SAMPLE_DELETE_ANNOTATION);
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      const annotations = await annotationService.getAll('working');

      expect(annotations).toHaveLength(3);
    });

    it('should return empty array for version with no annotations', async () => {
      const annotations = await annotationService.getAll('empty-version');
      expect(annotations).toHaveLength(0);
    });

    it('should throw ANNOTATION_VERSION_NOT_FOUND for invalid version', async () => {
      await expect(annotationService.getAll('non-existent-version'))
        .rejects.toMatchObject({
          code: 'ANNOTATION_VERSION_NOT_FOUND',
        });
    });

    it('should return annotations from sealed version as read-only', async () => {
      // sealed 版本的标注应可读取但不可修改
      const annotations = await annotationService.getAll('sealed-version-id');
      expect(annotations).toBeInstanceOf(Array);
    });
  });

  describe('update()', () => {
    it('should update annotation comment on unsealed version', async () => {
      const ann = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      const updated = await annotationService.update(ann.id, { comment: 'Updated comment' });

      expect(updated.comment).toBe('Updated comment');
      expect(updated.id).toBe(ann.id);
    });

    it('should throw ANNOTATION_NOT_FOUND for non-existent annotation', async () => {
      await expect(annotationService.update('non-existent-id', { comment: 'test' }))
        .rejects.toMatchObject({
          code: 'ANNOTATION_NOT_FOUND',
        });
    });

    it('should reject update on sealed version', async () => {
      await expect(annotationService.update('sealed-annotation-id', { comment: 'new' }))
        .rejects.toMatchObject({
          code: 'ANNOTATION_VERSION_SEALED',
        });
    });
  });

  describe('delete()', () => {
    it('should delete an annotation from unsealed version', async () => {
      const ann = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      await annotationService.delete(ann.id);

      const annotations = await annotationService.getAll('working');
      expect(annotations.find(a => a.id === ann.id)).toBeUndefined();
    });

    it('should throw ANNOTATION_NOT_FOUND for non-existent annotation', async () => {
      await expect(annotationService.delete('non-existent-id'))
        .rejects.toMatchObject({
          code: 'ANNOTATION_NOT_FOUND',
        });
    });

    it('should reject deletion on sealed version', async () => {
      await expect(annotationService.delete('sealed-version-annotation-id'))
        .rejects.toMatchObject({
          code: 'ANNOTATION_VERSION_SEALED',
        });
    });
  });

  describe('seal workflow', () => {
    it('should seal version when submitting annotations', async () => {
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      await annotationService.create('working', SAMPLE_DELETE_ANNOTATION);

      const result = await annotationService.submit('working');

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.annotationCount).toBe(2);
    });

    it('should reject further modifications after version is sealed', async () => {
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      await annotationService.submit('working');

      // After submit (seal), no more modifications allowed
      await expect(annotationService.create('working', SAMPLE_DELETE_ANNOTATION))
        .rejects.toMatchObject({
          code: 'ANNOTATION_VERSION_SEALED',
        });
    });

    it('should throw ANNOTATION_EMPTY when no annotations to submit', async () => {
      await expect(annotationService.submit('empty-working'))
        .rejects.toMatchObject({
          code: 'ANNOTATION_EMPTY',
        });
    });

    it('should generate markdown export format on submit', async () => {
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);

      const result = await annotationService.submit('working');

      expect(result.format).toBe('markdown');
      expect(result.content).toContain('用户标注反馈');
    });
  });

  describe('export()', () => {
    it('should export annotations as text with anchor element summary', async () => {
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);

      const result = await annotationService.export('working', { format: 'markdown' });

      expect(result.format).toBe('markdown');
      expect(result.content).toContain('用户标注反馈');
      expect(result.annotationCount).toBe(2);
    });

    it('should export annotations in JSON format', async () => {
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);

      const result = await annotationService.export('working', { format: 'json' });

      expect(result.format).toBe('json');
      const parsed = JSON.parse(result.content);
      expect(parsed).toBeInstanceOf(Array);
      expect(parsed).toHaveLength(1);
    });

    it('should include screenshots by default for ink annotations', async () => {
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      const result = await annotationService.export('working', { format: 'markdown' });

      expect(result.content).toContain('base64');
    });

    it('should exclude screenshots when includeScreenshots is false', async () => {
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      const result = await annotationService.export('working', {
        format: 'markdown',
        includeScreenshots: false,
      });

      expect(result.content).not.toContain('data:image/png;base64');
    });

    it('should export from sealed version (read-only access)', async () => {
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      await annotationService.submit('working');

      // Even after sealing, export should still work (read-only)
      const result = await annotationService.export('working', { format: 'markdown' });
      expect(result.annotationCount).toBe(1);
    });
  });
});
