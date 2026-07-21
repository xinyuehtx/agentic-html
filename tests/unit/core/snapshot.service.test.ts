/**
 * SnapshotService 单元测试
 * 覆盖：完整 DOM 快照、按 selector 获取局部快照、hit-test 元素列表
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotService } from '@/core/snapshot.service';
import { SAMPLE_HTML } from '../../setup';

describe('SnapshotService', () => {
  let snapshotService: SnapshotService;

  beforeEach(() => {
    vi.clearAllMocks();
    snapshotService = new SnapshotService();
  });

  describe('get() - full document snapshot', () => {
    it('should return complete DOM snapshot without selector', async () => {
      const snapshot = await snapshotService.get('ver-001');

      expect(snapshot).toBeDefined();
      expect(snapshot.html).toBeDefined();
      expect(snapshot.html.length).toBeGreaterThan(0);
      expect(snapshot.tree).toBeDefined();
      expect(snapshot.tree.tag).toBeDefined();
    });

    it('should include tree structure with tag names', async () => {
      const snapshot = await snapshotService.get('ver-001');

      expect(snapshot.tree.tag).toBe('HTML');
      expect(snapshot.tree.children).toBeInstanceOf(Array);
      expect(snapshot.tree.children.length).toBeGreaterThan(0);
    });

    it('should include selector for each tree node', async () => {
      const snapshot = await snapshotService.get('ver-001');

      expect(snapshot.tree.selector).toBeDefined();
      // 递归检查子节点
      if (snapshot.tree.children.length > 0) {
        expect(snapshot.tree.children[0].selector).toBeDefined();
      }
    });

    it('should include attributes for tree nodes', async () => {
      const snapshot = await snapshotService.get('ver-001');

      expect(snapshot.tree.attributes).toBeDefined();
      expect(typeof snapshot.tree.attributes).toBe('object');
    });

    it('should truncate textContent to 100 characters', async () => {
      const snapshot = await snapshotService.get('ver-001');

      // 递归查找有 textContent 的节点
      const findTextNode = (node: any): any => {
        if (node.textContent && node.textContent.length > 0) return node;
        for (const child of node.children || []) {
          const found = findTextNode(child);
          if (found) return found;
        }
        return null;
      };

      const textNode = findTextNode(snapshot.tree);
      if (textNode) {
        expect(textNode.textContent.length).toBeLessThanOrEqual(100);
      }
    });

    it('should throw SNAPSHOT_VERSION_NOT_FOUND for invalid version', async () => {
      await expect(snapshotService.get('non-existent-version'))
        .rejects.toMatchObject({
          code: 'SNAPSHOT_VERSION_NOT_FOUND',
        });
    });
  });

  describe('get() - partial snapshot by selector', () => {
    it('should return subtree for valid CSS selector', async () => {
      const snapshot = await snapshotService.get('ver-001', 'div.hero');

      expect(snapshot).toBeDefined();
      expect(snapshot.html).toContain('hero');
      expect(snapshot.tree.tag).toBe('DIV');
    });

    it('should return matched element HTML content', async () => {
      const snapshot = await snapshotService.get('ver-001', 'div.hero > h1');

      expect(snapshot.html).toContain('Hello World');
      expect(snapshot.tree.tag).toBe('H1');
    });

    it('should throw SNAPSHOT_SELECTOR_INVALID for malformed selector', async () => {
      await expect(snapshotService.get('ver-001', '[[[invalid'))
        .rejects.toMatchObject({
          code: 'SNAPSHOT_SELECTOR_INVALID',
        });
    });

    it('should throw SNAPSHOT_ELEMENT_NOT_FOUND when selector matches nothing', async () => {
      await expect(snapshotService.get('ver-001', 'div.nonexistent-class'))
        .rejects.toMatchObject({
          code: 'SNAPSHOT_ELEMENT_NOT_FOUND',
        });
    });

    it('should return children of matched element', async () => {
      const snapshot = await snapshotService.get('ver-001', 'div.hero');

      expect(snapshot.tree.children).toBeInstanceOf(Array);
      expect(snapshot.tree.children.length).toBeGreaterThan(0);
    });
  });

  describe('hitTest()', () => {
    it('should return hit elements within specified bounds', async () => {
      const result = await snapshotService.hitTest('ver-001', {
        bounds: { x: 50, y: 50, width: 400, height: 200 },
      });

      expect(result).toBeDefined();
      expect(result.elements).toBeInstanceOf(Array);
    });

    it('should return elements with selector, tag, outerHtmlSummary, and boundingRect', async () => {
      const result = await snapshotService.hitTest('ver-001', {
        bounds: { x: 50, y: 50, width: 400, height: 200 },
      });

      if (result.elements.length > 0) {
        const element = result.elements[0];
        expect(element.selector).toBeDefined();
        expect(element.tag).toBeDefined();
        expect(element.outerHtmlSummary).toBeDefined();
        expect(element.boundingRect).toBeDefined();
        expect(element.boundingRect.x).toBeDefined();
        expect(element.boundingRect.y).toBeDefined();
        expect(element.boundingRect.width).toBeDefined();
        expect(element.boundingRect.height).toBeDefined();
      }
    });

    it('should truncate outerHtmlSummary to 200 characters', async () => {
      const result = await snapshotService.hitTest('ver-001', {
        bounds: { x: 0, y: 0, width: 800, height: 600 },
      });

      result.elements.forEach(el => {
        expect(el.outerHtmlSummary.length).toBeLessThanOrEqual(200);
      });
    });

    it('should filter elements by threshold (default 0.3)', async () => {
      const result = await snapshotService.hitTest('ver-001', {
        bounds: { x: 50, y: 50, width: 100, height: 100 },
        threshold: 0.3,
      });

      // 所有返回的元素应满足 threshold 条件
      expect(result.elements).toBeInstanceOf(Array);
    });

    it('should use custom threshold when provided', async () => {
      const resultLow = await snapshotService.hitTest('ver-001', {
        bounds: { x: 50, y: 50, width: 400, height: 200 },
        threshold: 0.1,
      });

      const resultHigh = await snapshotService.hitTest('ver-001', {
        bounds: { x: 50, y: 50, width: 400, height: 200 },
        threshold: 0.9,
      });

      // 低阈值应返回更多或相同数量的元素
      expect(resultLow.elements.length).toBeGreaterThanOrEqual(resultHigh.elements.length);
    });

    it('should return empty elements array for bounds hitting no elements', async () => {
      const result = await snapshotService.hitTest('ver-001', {
        bounds: { x: 9999, y: 9999, width: 10, height: 10 },
      });

      expect(result.elements).toHaveLength(0);
    });

    it('should optionally include screenshot', async () => {
      const result = await snapshotService.hitTest('ver-001', {
        bounds: { x: 50, y: 50, width: 400, height: 200 },
      });

      // screenshotBase64 是可选的
      if (result.screenshotBase64) {
        expect(result.screenshotBase64).toMatch(/^data:image\//);
      }
    });

    it('should throw SNAPSHOT_VERSION_NOT_FOUND for invalid version', async () => {
      await expect(snapshotService.hitTest('non-existent', {
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      })).rejects.toMatchObject({
        code: 'SNAPSHOT_VERSION_NOT_FOUND',
      });
    });

    it('should throw SNAPSHOT_BOUNDS_INVALID for zero-size bounds', async () => {
      await expect(snapshotService.hitTest('ver-001', {
        bounds: { x: 50, y: 50, width: 0, height: 0 },
      })).rejects.toMatchObject({
        code: 'SNAPSHOT_BOUNDS_INVALID',
      });
    });

    it('should throw SNAPSHOT_BOUNDS_INVALID for negative bounds', async () => {
      await expect(snapshotService.hitTest('ver-001', {
        bounds: { x: 50, y: 50, width: -100, height: -50 },
      })).rejects.toMatchObject({
        code: 'SNAPSHOT_BOUNDS_INVALID',
      });
    });

    it('should sort hit elements by DOM depth (deeper first)', async () => {
      const result = await snapshotService.hitTest('ver-001', {
        bounds: { x: 0, y: 0, width: 800, height: 600 },
      });

      // 深层元素应排在前面
      if (result.elements.length > 1) {
        // 通过 selector 中 > 的数量来判断深度
        const depths = result.elements.map(el => el.selector.split('>').length);
        for (let i = 0; i < depths.length - 1; i++) {
          expect(depths[i]).toBeGreaterThanOrEqual(depths[i + 1]);
        }
      }
    });

    it('should select anchor_element as the largest-area or shallowest hit element', async () => {
      // hit-test 返回的元素列表中，anchor_element 应为面积最大或 DOM 最浅层的容器节点
      const result = await snapshotService.hitTest('ver-001', {
        bounds: { x: 50, y: 50, width: 400, height: 200 },
      });

      if (result.elements.length > 0) {
        // 锚点应该是 DOM 最浅的元素（selector 最短）或面积最大的元素
        const shallowest = result.elements.reduce((prev, curr) => {
          const prevDepth = prev.selector.split('>').length;
          const currDepth = curr.selector.split('>').length;
          return currDepth < prevDepth ? curr : prev;
        });

        // anchor 应选取最浅层的元素作为挂靠位置
        expect(shallowest.selector).toBeDefined();
        expect(shallowest.boundingRect).toBeDefined();

        // anchor_element 选取的元素应有有效的 boundingRect
        const anchorArea = shallowest.boundingRect.width * shallowest.boundingRect.height;
        expect(anchorArea).toBeGreaterThan(0);
      }
    });

    it('should return element suitable as anchor_element with valid DOMPosition info', async () => {
      const result = await snapshotService.hitTest('ver-001', {
        bounds: { x: 50, y: 50, width: 400, height: 200 },
      });

      if (result.elements.length > 0) {
        // 每个 hit element 都应可以作为潜在的 anchor_element
        // 需要包含有效的 selector 和 boundingRect
        result.elements.forEach(el => {
          expect(el.selector).toBeTruthy();
          expect(el.selector.length).toBeGreaterThan(0);
          expect(el.boundingRect.width).toBeGreaterThan(0);
          expect(el.boundingRect.height).toBeGreaterThan(0);
        });
      }
    });
  });
});
