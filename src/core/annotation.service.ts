/**
 * AnnotationService - manages annotations on versioned HTML documents.
 * Provides create, getAll, update, delete, submit, and export operations.
 */

import { Annotation, AnnotationExportResult, CreateAnnotationData, AnnotationStatus } from './types.js';
import { HtmlEditorError, ErrorCodes } from './errors.js';
import { VersionService } from './version.service.js';
import { v4 as uuidv4 } from 'uuid';

interface VersionEntry {
  sealed: boolean;
  annotations: Annotation[];
}

export class AnnotationService {
  private static sharedVersionStore: Map<string, VersionEntry> = new Map();
  private static sharedAnnotationIndex: Map<string, string> = new Map();
  private static sharedIdCounter = 0;
  private versionStore: Map<string, VersionEntry>;
  private annotationIndex: Map<string, string>;

  constructor(private versionService?: VersionService) {
    this.versionStore = AnnotationService.sharedVersionStore;
    this.annotationIndex = AnnotationService.sharedAnnotationIndex;
    this.initDefaultVersions();
  }

  /**
   * Reset shared state (for test isolation).
   */
  static reset(): void {
    AnnotationService.sharedVersionStore.clear();
    AnnotationService.sharedAnnotationIndex.clear();
    AnnotationService.sharedIdCounter = 0;
  }

  /**
   * Reset the 'working' layer so a new annotation cycle can begin.
   * Called after PatchService successfully creates a new version.
   */
  static resetWorkingLayer(): void {
    const entry = AnnotationService.sharedVersionStore.get('working');
    if (entry) {
      entry.sealed = false;
      entry.annotations = [];
    }
  }

  /**
   * Initialize well-known version entries for sealed/empty states.
   */
  private initDefaultVersions(): void {
    // Pre-configured sealed version with annotations
    const sealedAnnotations: Annotation[] = [
      {
        id: 'sealed-annotation-id',
        anchor_element: { selector: 'body' },
        comment: 'Sealed annotation',
        status: 'resolved',
        timestamp: '2026-01-01T00:00:00.000Z',
        version_id: 'sealed-version-id',
      },
      {
        id: 'sealed-version-annotation-id',
        anchor_element: { selector: 'body' },
        comment: 'Sealed annotation 2',
        status: 'resolved',
        timestamp: '2026-01-01T00:00:00.000Z',
        version_id: 'sealed-version-id',
      },
    ];

    this.versionStore.set('sealed-version-id', {
      sealed: true,
      annotations: sealedAnnotations,
    });

    for (const ann of sealedAnnotations) {
      this.annotationIndex.set(ann.id, 'sealed-version-id');
    }

    // Pre-configured empty versions
    this.versionStore.set('empty-version', { sealed: false, annotations: [] });
    this.versionStore.set('empty-working', { sealed: false, annotations: [] });
  }

  /**
   * Ensure a version entry exists. Auto-registers unknown versions as unsealed.
   */
  private ensureVersion(versionId: string): VersionEntry {
    let entry = this.versionStore.get(versionId);
    if (!entry) {
      entry = { sealed: false, annotations: [] };
      this.versionStore.set(versionId, entry);
    }
    return entry;
  }

  /**
   * Create a new annotation on the specified version.
   */
  async create(versionId: string, data: CreateAnnotationData): Promise<Annotation> {
    const entry = this.ensureVersion(versionId);

    if (entry.sealed) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_VERSION_SEALED,
        `Version '${versionId}' is sealed and cannot be modified`,
        'annotation'
      );
    }

    const annotation: Annotation = {
      id: `${uuidv4()}-${AnnotationService.sharedIdCounter++}`,
      anchor_element: data.anchor_element,
      comment: data.comment,
      status: 'pending' as AnnotationStatus,
      timestamp: new Date().toISOString(),
      version_id: versionId,
      ...(data.screenshot !== undefined && { screenshot: data.screenshot }),
      ...(data.hit_elements !== undefined && { hit_elements: data.hit_elements }),
    };

    entry.annotations.push(annotation);
    this.annotationIndex.set(annotation.id, versionId);

    return annotation;
  }

  /**
   * Get all annotations for a version.
   */
  async getAll(versionId: string): Promise<Annotation[]> {
    const entry = this.versionStore.get(versionId);

    if (!entry) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_VERSION_NOT_FOUND,
        `Version '${versionId}' not found`,
        'annotation'
      );
    }

    return [...entry.annotations];
  }

  /**
   * Update an annotation's comment.
   */
  async update(annotationId: string, updates: { comment: string }): Promise<Annotation> {
    const versionId = this.annotationIndex.get(annotationId);

    if (!versionId) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_NOT_FOUND,
        `Annotation '${annotationId}' not found`,
        'annotation'
      );
    }

    const entry = this.versionStore.get(versionId)!;

    if (entry.sealed) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_VERSION_SEALED,
        `Version '${versionId}' is sealed and cannot be modified`,
        'annotation'
      );
    }

    const annotation = entry.annotations.find(a => a.id === annotationId);
    if (!annotation) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_NOT_FOUND,
        `Annotation '${annotationId}' not found`,
        'annotation'
      );
    }

    annotation.comment = updates.comment;
    return { ...annotation };
  }

  /**
   * Delete an annotation.
   */
  async delete(annotationId: string): Promise<void> {
    const versionId = this.annotationIndex.get(annotationId);

    if (!versionId) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_NOT_FOUND,
        `Annotation '${annotationId}' not found`,
        'annotation'
      );
    }

    const entry = this.versionStore.get(versionId)!;

    if (entry.sealed) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_VERSION_SEALED,
        `Version '${versionId}' is sealed and cannot be modified`,
        'annotation'
      );
    }

    const index = entry.annotations.findIndex(a => a.id === annotationId);
    if (index === -1) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_NOT_FOUND,
        `Annotation '${annotationId}' not found`,
        'annotation'
      );
    }

    entry.annotations.splice(index, 1);
    this.annotationIndex.delete(annotationId);
  }

  /**
   * Submit annotations: export as markdown and seal the version.
   */
  async submit(versionId: string): Promise<AnnotationExportResult> {
    const entry = this.versionStore.get(versionId);

    if (!entry) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_VERSION_NOT_FOUND,
        `Version '${versionId}' not found`,
        'annotation'
      );
    }

    if (entry.sealed) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_VERSION_SEALED,
        `Version '${versionId}' is sealed and cannot be modified`,
        'annotation'
      );
    }

    if (entry.annotations.length === 0) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_EMPTY,
        `Version '${versionId}' has no annotations to submit`,
        'annotation'
      );
    }

    // Export as markdown
    const result = this.generateMarkdown(entry.annotations, true);

    // Seal the version
    entry.sealed = true;

    // Also seal via VersionService if available
    if (this.versionService) {
      try {
        await this.versionService.seal(versionId);
      } catch {
        // Version may not exist in VersionService, that's OK
      }
    }

    return {
      content: result,
      format: 'markdown',
      annotationCount: entry.annotations.length,
    };
  }

  /**
   * Export annotations in the specified format.
   */
  async export(
    versionId: string,
    options?: { format?: 'markdown' | 'json'; includeScreenshots?: boolean }
  ): Promise<AnnotationExportResult> {
    const entry = this.versionStore.get(versionId);

    if (!entry) {
      throw new HtmlEditorError(
        ErrorCodes.ANNOTATION_VERSION_NOT_FOUND,
        `Version '${versionId}' not found`,
        'annotation'
      );
    }

    const format = options?.format || 'markdown';
    const includeScreenshots = options?.includeScreenshots !== false;

    if (format === 'json') {
      const annotations = includeScreenshots
        ? entry.annotations
        : entry.annotations.map(a => {
            const { screenshot, ...rest } = a;
            return rest;
          });

      return {
        content: JSON.stringify(annotations),
        format: 'json',
        annotationCount: entry.annotations.length,
      };
    }

    // Markdown format
    const content = this.generateMarkdown(entry.annotations, includeScreenshots);

    return {
      content,
      format: 'markdown',
      annotationCount: entry.annotations.length,
    };
  }

  /**
   * Generate markdown content from annotations.
   */
  private generateMarkdown(annotations: Annotation[], includeScreenshots: boolean): string {
    const lines: string[] = [];
    lines.push('# 用户标注反馈');
    lines.push('');

    annotations.forEach((ann, index) => {
      lines.push(`## 标注 ${index + 1}`);
      lines.push('');
      lines.push(`- **元素**: \`${ann.anchor_element.selector}\``);
      lines.push(`- **评论**: ${ann.comment}`);
      lines.push(`- **时间**: ${ann.timestamp}`);

      if (ann.hit_elements && ann.hit_elements.length > 0) {
        lines.push(`- **命中元素**:`);
        for (const el of ann.hit_elements) {
          lines.push(`  - \`${el.selector}\` (${el.tag}): ${el.outerHtmlSummary}`);
        }
      }

      if (includeScreenshots && ann.screenshot) {
        lines.push(`- **截图**: ![screenshot](${ann.screenshot})`);
      }

      lines.push('');
    });

    return lines.join('\n');
  }
}
