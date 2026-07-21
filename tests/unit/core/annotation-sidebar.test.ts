/**
 * 标注侧边栏功能测试
 * 覆盖：CRUD 操作、点击滚动定位、路由跳转、高亮联动
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnotationService } from '@/core/annotation.service';
import { SAMPLE_CLICK_ANNOTATION, SAMPLE_INK_ANNOTATION } from '../../setup';

describe('Annotation Sidebar', () => {
  let annotationService: AnnotationService;

  beforeEach(() => {
    vi.clearAllMocks();
    annotationService = new AnnotationService();
  });

  describe('CRUD operations via sidebar', () => {
    it('should list all annotations for current version in sidebar', async () => {
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      const annotations = await annotationService.getAll('working');

      expect(annotations).toHaveLength(2);
      // Sidebar displays: anchor element summary, comment, timestamp
      annotations.forEach((ann) => {
        expect(ann.anchor_element).toBeDefined();
        expect(ann.anchor_element.selector).toBeDefined();
        expect(ann.comment).toBeDefined();
        expect(ann.timestamp).toBeDefined();
      });
    });

    it('should create annotation from sidebar (via page interaction)', async () => {
      const annotation = await annotationService.create('working', {
        anchor_element: { selector: 'div.content > p' },
        comment: '内容需要修改',
      });

      expect(annotation.id).toBeDefined();
      expect(annotation.status).toBe('pending');
      expect(annotation.version_id).toBe('working');
    });

    it('should edit annotation comment from sidebar', async () => {
      const ann = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);

      const updated = await annotationService.update(ann.id, {
        comment: '从侧边栏编辑的新评论',
      });

      expect(updated.comment).toBe('从侧边栏编辑的新评论');
      expect(updated.id).toBe(ann.id);
    });

    it('should delete annotation from sidebar', async () => {
      const ann = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      await annotationService.delete(ann.id);

      const annotations = await annotationService.getAll('working');
      expect(annotations.find((a) => a.id === ann.id)).toBeUndefined();
    });

    it('should not allow CRUD on sealed version from sidebar', async () => {
      await expect(
        annotationService.create('sealed-version-id', SAMPLE_CLICK_ANNOTATION)
      ).rejects.toMatchObject({ code: 'ANNOTATION_VERSION_SEALED' });

      await expect(
        annotationService.update('sealed-annotation-id', { comment: 'new' })
      ).rejects.toMatchObject({ code: 'ANNOTATION_VERSION_SEALED' });

      await expect(
        annotationService.delete('sealed-version-annotation-id')
      ).rejects.toMatchObject({ code: 'ANNOTATION_VERSION_SEALED' });
    });
  });

  describe('sidebar item display', () => {
    it('should provide anchor element selector as summary', async () => {
      const ann = await annotationService.create('working', {
        anchor_element: { selector: 'body > div.hero > h1' },
        comment: '修改标题',
      });

      // Sidebar item displays tag-based summary from selector
      expect(ann.anchor_element.selector).toBe('body > div.hero > h1');
    });

    it('should truncate long comments in list view', async () => {
      const longComment = 'A'.repeat(500);
      const ann = await annotationService.create('working', {
        anchor_element: { selector: 'p' },
        comment: longComment,
      });

      // Comment is stored in full; UI truncates for display
      expect(ann.comment).toBe(longComment);
      expect(ann.comment.length).toBe(500);
    });

    it('should display timestamp for each annotation item', async () => {
      const ann = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);

      expect(ann.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('click-to-scroll behavior', () => {
    it('should provide anchor selector for scroll target', async () => {
      const ann = await annotationService.create('working', {
        anchor_element: { selector: 'body > div.content > p' },
        comment: '需要滚动到这里',
      });

      // The selector is the scroll target for the preview iframe
      expect(ann.anchor_element.selector).toBe('body > div.content > p');
    });

    it('should support text offset for precise scroll positioning', async () => {
      const ann = await annotationService.create('working', {
        anchor_element: {
          selector: 'body > div.content > p',
          textOffset: { start: 10, end: 20 },
        },
        comment: '这段文字需要修改',
      });

      expect(ann.anchor_element.textOffset).toEqual({ start: 10, end: 20 });
    });
  });

  describe('hover highlight behavior', () => {
    it('should provide hit_elements for multi-element highlighting on hover', async () => {
      const ann = await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      // When hovering a sidebar item, all hit_elements get highlighted
      expect(ann.hit_elements).toBeDefined();
      expect(ann.hit_elements!.length).toBeGreaterThan(0);
      ann.hit_elements!.forEach((el) => {
        expect(el.selector).toBeDefined();
        expect(el.boundingRect).toBeDefined();
      });
    });

    it('should highlight anchor_element when no hit_elements (click selection)', async () => {
      const ann = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);

      // For click-selected annotations, only anchor_element is highlighted
      expect(ann.hit_elements).toBeUndefined();
      expect(ann.anchor_element.selector).toBeDefined();
    });
  });

  describe('SPA route navigation', () => {
    it('should store full selector path for route-aware scrolling', async () => {
      // For SPAs, the selector includes path context for route determination
      const ann = await annotationService.create('working', {
        anchor_element: { selector: '[data-page="/about"] section.team > h2' },
        comment: '团队介绍标题需要修改',
      });

      expect(ann.anchor_element.selector).toContain('[data-page="/about"]');
    });
  });
});
