/**
 * VerificationService - DOM comparison + Playwright visual screenshot comparison.
 * Provides dual-layer verification after patch application.
 */

import * as cheerio from 'cheerio';
import type {
  Patch,
  VerificationResult,
  DomComparisonResult,
  VisualComparisonResult,
  DomChange,
  BoundingBox,
} from './types.js';

export class VerificationService {
  private screenshotDir: string;
  private browser: any | null = null;

  constructor(screenshotDir: string = '.html-editor/verification') {
    this.screenshotDir = screenshotDir;
  }

  /**
   * Verify changes between old and new HTML using DOM comparison + visual comparison.
   */
  async verify(oldHtml: string, newHtml: string, patches: Patch[]): Promise<VerificationResult> {
    // 1. DOM comparison (synchronous, fast)
    const domResult = this.compareDom(oldHtml, newHtml, patches);

    // 2. Visual comparison (async, requires Playwright)
    let visualResult: VisualComparisonResult | null = null;
    try {
      visualResult = await this.compareVisual(oldHtml, newHtml);
    } catch {
      // Playwright unavailable - degrade to DOM-only comparison
      visualResult = null;
    }

    // 3. Synthesize results
    return this.synthesize(domResult, visualResult, patches);
  }

  // --- DOM Comparison ---

  private compareDom(oldHtml: string, newHtml: string, patches: Patch[]): DomComparisonResult {
    const $old = cheerio.load(oldHtml);
    const $new = cheerio.load(newHtml);
    const patchSelectors = patches.map(p => p.selector);
    const changes: DomChange[] = [];

    // Check for removed and modified elements
    $old('*').each((_: number, el: any) => {
      const oldEl = $old(el);
      const selector = this.getUniqueSelector(oldEl, $old);
      if (!selector) return;

      const newEl = $new(selector);
      if (newEl.length === 0) {
        const expected = this.isExpectedChange(selector, patchSelectors);
        changes.push({
          type: 'removed',
          selector,
          description: `Element ${selector} was removed`,
          severity: expected ? 'info' : 'error',
          expected,
        });
      } else {
        const oldAttrs = this.getAttributes(oldEl);
        const newAttrs = this.getAttributes(newEl);
        const oldText = oldEl.text().trim();
        const newText = newEl.text().trim();

        if (JSON.stringify(oldAttrs) !== JSON.stringify(newAttrs) || oldText !== newText) {
          const expected = this.isExpectedChange(selector, patchSelectors);
          changes.push({
            type: 'modified',
            selector,
            description: `Element ${selector} was modified`,
            severity: expected ? 'info' : (oldText !== newText ? 'warning' : 'info'),
            expected,
          });
        }
      }
    });

    // Check for added elements
    $new('*').each((_: number, el: any) => {
      const newEl = $new(el);
      const selector = this.getUniqueSelector(newEl, $new);
      if (!selector) return;

      const oldEl = $old(selector);
      if (oldEl.length === 0) {
        const expected = this.isExpectedChange(selector, patchSelectors);
        changes.push({
          type: 'added',
          selector,
          description: `Element ${selector} was added`,
          severity: expected ? 'info' : 'warning',
          expected,
        });
      }
    });

    return {
      totalChanges: changes.length,
      additions: changes.filter(c => c.type === 'added').length,
      deletions: changes.filter(c => c.type === 'removed').length,
      modifications: changes.filter(c => c.type === 'modified').length,
      changes,
    };
  }

  // --- Visual Comparison ---

  private async compareVisual(oldHtml: string, newHtml: string): Promise<VisualComparisonResult> {
    const { chromium } = await import('playwright');
    const fs = await import('fs');
    const path = await import('path');
    const { PNG } = await import('pngjs');
    const pixelmatch = (await import('pixelmatch')).default;

    // Ensure screenshot directory exists
    const dir = path.resolve(this.screenshotDir);
    fs.mkdirSync(dir, { recursive: true });

    // Launch/reuse browser
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }

    const page = await this.browser.newPage({ viewport: { width: 1280, height: 720 } });

    // Screenshot old version
    await page.setContent(oldHtml, { waitUntil: 'networkidle' });
    const beforePath = path.join(dir, `before-${Date.now()}.png`);
    await page.screenshot({ path: beforePath, fullPage: true });

    // Screenshot new version
    await page.setContent(newHtml, { waitUntil: 'networkidle' });
    const afterPath = path.join(dir, `after-${Date.now()}.png`);
    await page.screenshot({ path: afterPath, fullPage: true });

    await page.close();

    // pixelmatch comparison
    const img1 = PNG.sync.read(fs.readFileSync(beforePath));
    const img2 = PNG.sync.read(fs.readFileSync(afterPath));

    // Handle size differences
    const width = Math.max(img1.width, img2.width);
    const height = Math.max(img1.height, img2.height);
    const diff = new PNG({ width, height });

    const buf1 = this.resizeBuffer(img1, width, height);
    const buf2 = this.resizeBuffer(img2, width, height);

    const numDiffPixels = pixelmatch(buf1, buf2, diff.data, width, height, { threshold: 0.1 });
    const diffPercentage = (numDiffPixels / (width * height)) * 100;

    // Save diff image
    const diffPath = path.join(dir, `diff-${Date.now()}.png`);
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    // Detect changed regions
    const changedRegions = this.findChangedRegions(diff.data, width, height);

    return {
      diffPercentage: Math.round(diffPercentage * 100) / 100,
      diffImagePath: diffPath,
      changedRegions,
      beforeScreenshot: beforePath,
      afterScreenshot: afterPath,
    };
  }

  // --- Helper Methods ---

  private isExpectedChange(selector: string, patchSelectors: string[]): boolean {
    return patchSelectors.some(
      ps => selector === ps || selector.startsWith(ps + ' ') || selector.startsWith(ps + '>')
    );
  }

  private getUniqueSelector(el: any, $: any): string | null {
    const id = el.attr('id');
    if (id) return `#${id}`;

    const tagName = el.prop('tagName')?.toLowerCase();
    if (!tagName || tagName === 'html' || tagName === 'head' || tagName === 'body') return null;

    const classes = el.attr('class');
    if (classes) {
      const classSelector = '.' + classes.trim().split(/\s+/).join('.');
      return `${tagName}${classSelector}`;
    }

    return tagName;
  }

  private getAttributes(el: any): Record<string, string> {
    const attrs: Record<string, string> = {};
    const rawAttrs = el.attr();
    if (rawAttrs) {
      Object.keys(rawAttrs).sort().forEach((key: string) => {
        attrs[key] = rawAttrs[key];
      });
    }
    return attrs;
  }

  private resizeBuffer(img: any, width: number, height: number): Buffer {
    if (img.width === width && img.height === height) return img.data;
    const buf = Buffer.alloc(width * height * 4, 0);
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const srcIdx = (y * img.width + x) * 4;
        const dstIdx = (y * width + x) * 4;
        buf[dstIdx] = img.data[srcIdx];
        buf[dstIdx + 1] = img.data[srcIdx + 1];
        buf[dstIdx + 2] = img.data[srcIdx + 2];
        buf[dstIdx + 3] = img.data[srcIdx + 3];
      }
    }
    return buf;
  }

  private findChangedRegions(diffData: Buffer, width: number, height: number): BoundingBox[] {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasChange = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (diffData[idx] > 0 || diffData[idx + 1] > 0 || diffData[idx + 2] > 0) {
          hasChange = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasChange) return [];
    return [{ x: minX, y: minY, width: maxX - minX, height: maxY - minY }];
  }

  private synthesize(
    domResult: DomComparisonResult,
    visualResult: VisualComparisonResult | null,
    _patches: Patch[]
  ): VerificationResult {
    const expectedChanges = domResult.changes.filter(c => c.expected);
    const unexpectedChanges = domResult.changes.filter(c => !c.expected);

    // Adjust severity based on visual diff
    if (visualResult && visualResult.diffPercentage > 5) {
      unexpectedChanges.forEach(c => {
        if (c.severity === 'info') c.severity = 'warning';
      });
    }

    const hasError = unexpectedChanges.some(c => c.severity === 'error');
    const passed = !hasError;

    // Generate summary
    const parts: string[] = [];
    parts.push(`${expectedChanges.length} expected change(s)`);
    if (unexpectedChanges.length > 0) {
      parts.push(`${unexpectedChanges.length} unexpected change(s)`);
    }
    if (visualResult) {
      parts.push(`visual diff: ${visualResult.diffPercentage}%`);
    }
    if (!passed) {
      parts.push('FAILED - unexpected errors detected');
    }
    const summary = parts.join(', ');

    return {
      passed,
      domComparison: domResult,
      visualComparison: visualResult,
      expectedChanges,
      unexpectedChanges,
      summary,
    };
  }

  /** Cleanup browser instance */
  async dispose(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
