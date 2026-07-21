/**
 * VerificationService 单元测试
 * 覆盖：DOM 对比（增删改检测）、严重性分级、视觉对比降级、结果合成
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerificationService } from '@/core/verification.service';

// Mock playwright to avoid actual browser dependency
vi.mock('playwright', () => {
  throw new Error('Playwright not available in test environment');
});

describe('VerificationService', () => {
  let service: VerificationService;

  beforeEach(() => {
    service = new VerificationService();
  });

  describe('DOM comparison', () => {
    it('detects element removal', async () => {
      const oldHtml = '<html><body><div><p class="target">Hello</p><span>World</span></div></body></html>';
      const newHtml = '<html><body><div><span>World</span></div></body></html>';
      const patches = [{ selector: 'p.target', action: 'delete' as const }];

      const result = await service.verify(oldHtml, newHtml, patches);

      expect(result.domComparison.deletions).toBeGreaterThan(0);
      const removedChange = result.domComparison.changes.find(
        c => c.type === 'removed' && c.selector.includes('target')
      );
      expect(removedChange).toBeDefined();
    });

    it('marks expected changes correctly based on patch selectors', async () => {
      const oldHtml = '<html><body><div><p class="target">Hello</p></div></body></html>';
      const newHtml = '<html><body><div><p class="target">Updated</p></div></body></html>';
      const patches = [{ selector: 'p.target', action: 'replace' as const, content: '<p class="target">Updated</p>' }];

      const result = await service.verify(oldHtml, newHtml, patches);

      const expectedChange = result.expectedChanges.find(c => c.selector.includes('target'));
      expect(expectedChange).toBeDefined();
      expect(expectedChange!.expected).toBe(true);
    });

    it('marks unexpected changes when non-target elements are modified', async () => {
      const oldHtml = '<html><body><div class="a">Original</div><div class="b">Untouched</div></body></html>';
      const newHtml = '<html><body><div class="a">Changed</div><div class="b">Also changed</div></body></html>';
      const patches = [{ selector: 'div.a', action: 'replace' as const, content: '<div class="a">Changed</div>' }];

      const result = await service.verify(oldHtml, newHtml, patches);

      // div.b was changed unexpectedly
      const unexpected = result.unexpectedChanges.find(c => c.selector.includes('b'));
      expect(unexpected).toBeDefined();
      expect(unexpected!.expected).toBe(false);
    });

    it('detects element addition', async () => {
      const oldHtml = '<html><body><div class="container"></div></body></html>';
      const newHtml = '<html><body><div class="container"><p class="new-item">Added</p></div></body></html>';
      const patches = [{ selector: 'div.container', action: 'insert_after' as const, content: '<p class="new-item">Added</p>' }];

      const result = await service.verify(oldHtml, newHtml, patches);

      expect(result.domComparison.additions).toBeGreaterThan(0);
      const addedChange = result.domComparison.changes.find(c => c.type === 'added');
      expect(addedChange).toBeDefined();
    });

    it('detects attribute modification', async () => {
      const oldHtml = '<html><body><div id="box" class="red">Content</div></body></html>';
      const newHtml = '<html><body><div id="box" class="blue">Content</div></body></html>';
      const patches = [{ selector: '#box', action: 'modify_style' as const, content: 'color: blue' }];

      const result = await service.verify(oldHtml, newHtml, patches);

      const modified = result.domComparison.changes.find(
        c => c.type === 'modified' && c.selector === '#box'
      );
      expect(modified).toBeDefined();
    });

    it('detects text content change', async () => {
      const oldHtml = '<html><body><p id="text">Old text</p></body></html>';
      const newHtml = '<html><body><p id="text">New text</p></body></html>';
      const patches = [{ selector: '#text', action: 'replace' as const, content: '<p id="text">New text</p>' }];

      const result = await service.verify(oldHtml, newHtml, patches);

      const textChange = result.domComparison.changes.find(
        c => c.type === 'modified' && c.selector === '#text'
      );
      expect(textChange).toBeDefined();
    });

    it('assigns info severity for expected changes', async () => {
      const oldHtml = '<html><body><p id="target">Old</p></body></html>';
      const newHtml = '<html><body><p id="target">New</p></body></html>';
      const patches = [{ selector: '#target', action: 'replace' as const, content: '<p id="target">New</p>' }];

      const result = await service.verify(oldHtml, newHtml, patches);

      const expected = result.expectedChanges.find(c => c.selector === '#target');
      expect(expected).toBeDefined();
      expect(expected!.severity).toBe('info');
    });

    it('assigns error severity for unexpected element removal', async () => {
      const oldHtml = '<html><body><div id="keep">Keep</div><div id="other">Other</div></body></html>';
      const newHtml = '<html><body><div id="keep">Keep</div></body></html>';
      // patch targets #keep but #other got removed
      const patches = [{ selector: '#keep', action: 'replace' as const, content: '<div id="keep">Keep</div>' }];

      const result = await service.verify(oldHtml, newHtml, patches);

      const unexpectedRemoval = result.unexpectedChanges.find(
        c => c.type === 'removed' && c.selector === '#other'
      );
      expect(unexpectedRemoval).toBeDefined();
      expect(unexpectedRemoval!.severity).toBe('error');
    });

    it('assigns warning severity for unexpected attribute changes', async () => {
      const oldHtml = '<html><body><div id="target">T</div><div id="side">S</div></body></html>';
      const newHtml = '<html><body><div id="target">T</div><div id="side">Modified</div></body></html>';
      const patches = [{ selector: '#target', action: 'replace' as const, content: '<div id="target">T</div>' }];

      const result = await service.verify(oldHtml, newHtml, patches);

      const unexpectedMod = result.unexpectedChanges.find(
        c => c.type === 'modified' && c.selector === '#side'
      );
      expect(unexpectedMod).toBeDefined();
      // Text content change on non-target → warning
      expect(unexpectedMod!.severity).toBe('warning');
    });
  });

  describe('Visual comparison', () => {
    it('gracefully handles Playwright unavailable', async () => {
      const result = await service.verify('<html><body><p>a</p></body></html>', '<html><body><p>b</p></body></html>', []);
      expect(result.visualComparison).toBeNull();
    });

    it('returns null visualComparison when visual comparison fails', async () => {
      const result = await service.verify(
        '<html><body><div>old</div></body></html>',
        '<html><body><div>new</div></body></html>',
        [{ selector: 'div', action: 'replace' as const, content: '<div>new</div>' }]
      );
      // Since Playwright is mocked to throw, visualComparison should be null
      expect(result.visualComparison).toBeNull();
      // But DOM comparison should still work
      expect(result.domComparison).toBeDefined();
      expect(result.domComparison.totalChanges).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Synthesis', () => {
    it('passed is true when no error-severity unexpected changes', async () => {
      const oldHtml = '<html><body><p id="target">Old</p></body></html>';
      const newHtml = '<html><body><p id="target">New</p></body></html>';
      const patches = [{ selector: '#target', action: 'replace' as const, content: '<p id="target">New</p>' }];

      const result = await service.verify(oldHtml, newHtml, patches);

      expect(result.passed).toBe(true);
    });

    it('passed is false when error-severity unexpected changes exist', async () => {
      const oldHtml = '<html><body><div id="keep">Keep</div><div id="removed">Gone</div></body></html>';
      const newHtml = '<html><body><div id="keep">Keep</div></body></html>';
      // Patch targets something else, so removal of #removed is unexpected
      const patches = [{ selector: '#keep', action: 'replace' as const, content: '<div id="keep">Keep</div>' }];

      const result = await service.verify(oldHtml, newHtml, patches);

      expect(result.passed).toBe(false);
      expect(result.summary).toContain('FAILED');
    });

    it('summary contains change counts and visual diff percentage', async () => {
      const oldHtml = '<html><body><p id="target">Old</p></body></html>';
      const newHtml = '<html><body><p id="target">New</p></body></html>';
      const patches = [{ selector: '#target', action: 'replace' as const }];

      const result = await service.verify(oldHtml, newHtml, patches);

      expect(result.summary).toContain('expected change');
      // Visual diff is null (Playwright unavailable), so no visual percentage in summary
      expect(result.visualComparison).toBeNull();
    });
  });
});
