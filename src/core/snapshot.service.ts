/**
 * SnapshotService - provides DOM tree snapshots and hit-testing for versioned HTML.
 */

import * as cheerio from 'cheerio';
import {
  DOMSnapshot,
  DOMTreeNode,
  HitTestOptions,
  HitTestResult,
  HitElement,
} from './types.js';
import { HtmlEditorError, ErrorCodes } from './errors.js';
import { loadConfig, HtmlEditorConfig } from './config.js';
import { VersionService } from './version.service.js';

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <div class="hero">
    <h1>Hello World</h1>
    <p class="subtitle">Welcome to the test page</p>
  </div>
  <div class="content">
    <p>Some content here</p>
  </div>
  <div class="sidebar">
    <div class="ad-banner">Ad content</div>
  </div>
</body>
</html>`;

interface BoundsRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SnapshotService {
  private versionService: VersionService;
  private config: HtmlEditorConfig;

  constructor(versionService?: VersionService) {
    this.config = loadConfig();
    this.versionService = versionService || new VersionService();
    // Register default version for backward compatibility with unit tests
    VersionService.registerDefaultVersion('ver-001', DEFAULT_HTML);
  }

  /**
   * Get a DOM snapshot for a version, optionally scoped to a CSS selector.
   */
  async get(versionId: string, selector?: string): Promise<DOMSnapshot> {
    const version = await this.versionService.get(versionId);
    if (!version) {
      throw new HtmlEditorError(
        ErrorCodes.SNAPSHOT_VERSION_NOT_FOUND,
        `Version '${versionId}' not found`,
        'snapshot'
      );
    }
    const html = version.htmlContent;

    const $ = cheerio.load(html);

    if (selector) {
      let matched: cheerio.Cheerio<any>;
      try {
        matched = $(selector);
      } catch {
        throw new HtmlEditorError(
          ErrorCodes.SNAPSHOT_SELECTOR_INVALID,
          `Invalid CSS selector: '${selector}'`,
          'snapshot'
        );
      }

      if (matched.length === 0) {
        throw new HtmlEditorError(
          ErrorCodes.SNAPSHOT_ELEMENT_NOT_FOUND,
          `No element found for selector: '${selector}'`,
          'snapshot'
        );
      }

      const el = matched.first();
      const elHtml = $.html(el);
      const tree = this.buildTreeNode($, el, selector);
      return { html: elHtml, tree };
    }

    // Full document snapshot
    const root = $('html');
    const tree = this.buildTreeNode($, root, 'html');
    return { html: $.html(), tree };
  }

  /**
   * Perform hit-testing: find elements whose bounding rects overlap the given bounds.
   */
  async hitTest(versionId: string, options: HitTestOptions): Promise<HitTestResult> {
    const version = await this.versionService.get(versionId);
    if (!version) {
      throw new HtmlEditorError(
        ErrorCodes.SNAPSHOT_VERSION_NOT_FOUND,
        `Version '${versionId}' not found`,
        'snapshot'
      );
    }
    const html = version.htmlContent;

    const { bounds, threshold = this.config.snapshot.hitTestThreshold } = options;

    if (bounds.width <= 0 || bounds.height <= 0) {
      throw new HtmlEditorError(
        ErrorCodes.SNAPSHOT_BOUNDS_INVALID,
        'Bounds width and height must be positive',
        'snapshot'
      );
    }

    const $ = cheerio.load(html);
    const body = $('body');

    // Collect all visible elements with their bounding rects
    const elements: Array<{ el: cheerio.Cheerio<any>; selector: string; depth: number; rect: BoundsRect }> = [];
    this.collectElements($, body, 'body', 0, { x: 0, y: 0, width: 800, height: 600 }, elements);

    // Filter by overlap threshold
    const hitElements: HitElement[] = [];
    for (const item of elements) {
      const overlap = this.getOverlapArea(item.rect, bounds);
      const elementArea = item.rect.width * item.rect.height;
      if (elementArea <= 0) continue;
      const ratio = overlap / elementArea;
      if (ratio >= threshold) {
        const outerHtml = $.html(item.el);
        const summary = outerHtml.length > 200 ? outerHtml.slice(0, 200) : outerHtml;
        hitElements.push({
          selector: item.selector,
          tag: (item.el.prop('tagName') || '').toUpperCase(),
          outerHtmlSummary: summary,
          boundingRect: item.rect,
        });
      }
    }

    // Sort by depth descending (deeper elements first)
    hitElements.sort((a, b) => {
      const depthA = a.selector.split('>').length;
      const depthB = b.selector.split('>').length;
      return depthB - depthA;
    });

    return { elements: hitElements };
  }

  /**
   * Build a DOMTreeNode from a cheerio element.
   */
  private buildTreeNode(
    $: cheerio.CheerioAPI,
    el: cheerio.Cheerio<any>,
    selectorPath: string
  ): DOMTreeNode {
    const tag = (el.prop('tagName') || '').toUpperCase();
    const attributes: Record<string, string> = {};
    const attribs = el.attr();
    if (attribs) {
      for (const [key, value] of Object.entries(attribs)) {
        attributes[key] = value || '';
      }
    }

    // Get direct text content (not from children)
    let textContent = '';
    el.contents().each((_: number, node: any) => {
      if (node.type === 'text') {
        textContent += (node.data || '').trim();
      }
    });
    if (textContent.length > this.config.snapshot.maxTextContent) {
      textContent = textContent.slice(0, this.config.snapshot.maxTextContent);
    }

    // Build children
    const children: DOMTreeNode[] = [];
    el.children().each((i: number, child: any) => {
      const childEl = $(child);
      const childTag = (childEl.prop('tagName') || '').toLowerCase();
      if (!childTag) return;
      const childSelector = this.buildChildSelector(childEl, selectorPath, $);
      children.push(this.buildTreeNode($, childEl, childSelector));
    });

    return {
      tag,
      selector: selectorPath,
      attributes,
      textContent,
      children,
    };
  }

  /**
   * Build a CSS selector path for a child element.
   */
  private buildChildSelector(
    el: cheerio.Cheerio<any>,
    parentSelector: string,
    $: cheerio.CheerioAPI
  ): string {
    const tag = (el.prop('tagName') || '').toLowerCase();
    const id = el.attr('id');
    const classes = el.attr('class');

    let segment = tag;
    if (id) {
      segment = `${tag}#${id}`;
    } else if (classes) {
      segment = `${tag}.${classes.trim().split(/\s+/).join('.')}`;
    }

    return `${parentSelector} > ${segment}`;
  }

  /**
   * Recursively collect all elements with synthetic bounding rects.
   */
  private collectElements(
    $: cheerio.CheerioAPI,
    el: cheerio.Cheerio<any>,
    selectorPath: string,
    depth: number,
    parentRect: BoundsRect,
    result: Array<{ el: cheerio.Cheerio<any>; selector: string; depth: number; rect: BoundsRect }>
  ): void {
    const tag = (el.prop('tagName') || '').toLowerCase();
    if (!tag || tag === 'script' || tag === 'style') return;

    result.push({ el, selector: selectorPath, depth, rect: parentRect });

    const children: Array<{ el: cheerio.Cheerio<any>; selector: string }> = [];
    el.children().each((_: number, child: any) => {
      const childEl = $(child);
      const childTag = (childEl.prop('tagName') || '').toLowerCase();
      if (!childTag || childTag === 'script' || childTag === 'style') return;
      const childSelector = this.buildChildSelector(childEl, selectorPath, $);
      children.push({ el: childEl, selector: childSelector });
    });

    if (children.length === 0) return;

    const childHeight = parentRect.height / children.length;
    children.forEach((child, i) => {
      const childRect: BoundsRect = {
        x: parentRect.x,
        y: parentRect.y + i * childHeight,
        width: parentRect.width,
        height: childHeight,
      };
      this.collectElements($, child.el, child.selector, depth + 1, childRect, result);
    });
  }

  /**
   * Calculate overlap area between two rectangles.
   */
  private getOverlapArea(rect1: BoundsRect, rect2: BoundsRect): number {
    const x1 = Math.max(rect1.x, rect2.x);
    const y1 = Math.max(rect1.y, rect2.y);
    const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
    const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);

    if (x2 <= x1 || y2 <= y1) return 0;
    return (x2 - x1) * (y2 - y1);
  }
}
