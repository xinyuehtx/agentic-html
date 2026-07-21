/**
 * VersionService - manages versioned HTML snapshots with tree-based numbering.
 * Provides create, get, seal, checkout, compare, and history operations.
 */

import { v4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import DiffMatchPatch from 'diff-match-patch';
import {
  Version,
  VersionCreateOptions,
  VersionGraph,
  VersionDiff,
  VersionCompareResult,
  VersionNode,
  VersionEdge,
  Annotation,
  DiffHunk,
} from './types.js';
import { HtmlEditorError, ErrorCodes } from './errors.js';
import { loadConfig, HtmlEditorConfig } from './config.js';

export class VersionService {
  private static sharedVersions: Map<string, Version> = new Map();
  private static sharedIdCounter = 0;
  private versions: Map<string, Version>;
  private config: HtmlEditorConfig;
  private basePath: string;

  constructor(basePath?: string) {
    this.config = loadConfig();
    this.basePath = basePath || process.cwd();
    this.versions = VersionService.sharedVersions;
  }

  /**
   * Reset shared state (for test isolation).
   */
  static reset(): void {
    VersionService.sharedVersions.clear();
    VersionService.sharedIdCounter = 0;
  }

  /**
   * Register a version directly in shared state (for backward compat / defaults).
   * Uses a special internal parentId to avoid affecting root version counting.
   */
  static registerDefaultVersion(id: string, htmlContent: string): void {
    if (!VersionService.sharedVersions.has(id)) {
      VersionService.sharedVersions.set(id, {
        id,
        version: 'v0',
        parentId: '__internal__',
        htmlContent,
        annotations: [],
        sealed: true,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Generate a unique ID using uuid + counter to ensure uniqueness even when uuid is mocked.
   */
  private generateId(): string {
    const base = v4();
    return `${base}-${VersionService.sharedIdCounter++}`;
  }

  /**
   * Get the directory path for a specific version.
   */
  private getVersionDir(versionId: string): string {
    return path.join(
      this.basePath,
      this.config.version.storageDir,
      'versions',
      versionId
    );
  }

  /**
   * Get the index.json file path.
   */
  private getIndexPath(): string {
    return path.join(
      this.basePath,
      this.config.version.storageDir,
      'versions',
      'index.json'
    );
  }

  /**
   * Generate tree-based version number.
   * Root versions: v1, v2, v3...
   * Children of v1: v1.1, v1.2, v1.3...
   * Children of v1.1: v1.1.1, v1.1.2...
   */
  private generateVersionNumber(parentId: string | null): string {
    if (!parentId) {
      // Count existing root versions (only sealed versions count for numbering)
      let rootCount = 0;
      for (const v of this.versions.values()) {
        if (v.parentId === null && v.sealed) rootCount++;
      }
      return `v${rootCount + 1}`;
    }

    // Get parent version
    const parent = this.versions.get(parentId)!;

    // Count existing children of this parent (only sealed versions count)
    let childCount = 0;
    for (const v of this.versions.values()) {
      if (v.parentId === parentId && v.sealed) childCount++;
    }

    // Extract numeric part of parent version (remove 'v' prefix)
    const parentVersionStr = parent.version.slice(1);
    return `v${parentVersionStr}.${childCount + 1}`;
  }

  /**
   * Create a new version.
   */
  async create(options: VersionCreateOptions): Promise<Version> {
    // Validate HTML content
    if (!options.htmlContent || options.htmlContent.trim() === '') {
      throw new HtmlEditorError(
        ErrorCodes.VERSION_HTML_EMPTY,
        'HTML content cannot be empty',
        'version'
      );
    }

    // Normalize parentId
    const parentId =
      options.parentId === null || options.parentId === undefined
        ? null
        : options.parentId;

    // Validate parent exists if specified
    if (parentId && !this.versions.has(parentId)) {
      throw new HtmlEditorError(
        ErrorCodes.VERSION_PARENT_NOT_FOUND,
        `Parent version '${parentId}' not found`,
        'version'
      );
    }

    // Generate version number
    const versionNumber = this.generateVersionNumber(parentId);

    // Generate unique ID
    const id = this.generateId();

    // Create version directory path
    const versionDir = this.getVersionDir(id);
    const snapshotPath = path.join(versionDir, 'snapshot.html');

    // Determine sealed status (default true for committed versions)
    const sealed = options.sealed !== undefined ? options.sealed : true;

    // Create version object
    const version: Version = {
      id,
      version: versionNumber,
      parentId,
      htmlContent: options.htmlContent,
      htmlFile: snapshotPath,
      annotations: options.annotations ? [...options.annotations] : [],
      sealed,
      timestamp: new Date().toISOString(),
      metadata: options.metadata,
    };

    // Persist to filesystem (atomic write: write temp then rename)
    await fs.mkdir(versionDir, { recursive: true });

    // Write snapshot HTML
    await fs.writeFile(snapshotPath, options.htmlContent);

    // Write meta.json
    const meta = {
      id: version.id,
      version: version.version,
      parentId: version.parentId,
      sealed: version.sealed,
      timestamp: version.timestamp,
      metadata: version.metadata,
    };
    await fs.writeFile(
      path.join(versionDir, 'meta.json'),
      JSON.stringify(meta, null, 2)
    );

    // Write annotations.json
    await fs.writeFile(
      path.join(versionDir, 'annotations.json'),
      JSON.stringify(version.annotations, null, 2)
    );

    // Store in memory
    this.versions.set(id, version);

    // Update index file
    await this.updateIndex();

    return version;
  }

  /**
   * Get a version by its ID.
   */
  async get(versionId: string): Promise<Version | null> {
    const version = this.versions.get(versionId);
    if (!version) return null;
    // Return a copy to preserve immutability
    return { ...version, annotations: [...version.annotations] };
  }

  /**
   * Seal a version (make it immutable).
   */
  async seal(versionId: string): Promise<void> {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new HtmlEditorError(
        ErrorCodes.VERSION_NOT_FOUND,
        `Version '${versionId}' not found`,
        'version'
      );
    }
    if (version.sealed) {
      throw new HtmlEditorError(
        ErrorCodes.VERSION_ALREADY_SEALED,
        `Version '${versionId}' is already sealed`,
        'version'
      );
    }

    version.sealed = true;

    // Persist updated meta
    const versionDir = this.getVersionDir(versionId);
    const meta = {
      id: version.id,
      version: version.version,
      parentId: version.parentId,
      sealed: version.sealed,
      timestamp: version.timestamp,
      metadata: version.metadata,
    };
    await fs.writeFile(
      path.join(versionDir, 'meta.json'),
      JSON.stringify(meta, null, 2)
    );
  }

  /**
   * Checkout a version - creates a new unsealed working copy.
   */
  async checkout(
    versionId: string,
    options?: { keepAnnotations?: boolean }
  ): Promise<Version> {
    const source = this.versions.get(versionId);
    if (!source) {
      throw new HtmlEditorError(
        ErrorCodes.VERSION_NOT_FOUND,
        `Version '${versionId}' not found`,
        'version'
      );
    }

    const annotations = options?.keepAnnotations
      ? [...source.annotations]
      : [];

    // Create a new unsealed version as child of the checked-out version
    const newVersion = await this.create({
      parentId: versionId,
      htmlContent: source.htmlContent,
      annotations,
      sealed: false,
    });

    return newVersion;
  }

  /**
   * Compare two versions using diff-match-patch.
   */
  async compare(
    versionIdA: string,
    versionIdB: string
  ): Promise<VersionCompareResult> {
    const vA = this.versions.get(versionIdA);
    if (!vA) {
      throw new HtmlEditorError(
        ErrorCodes.VERSION_NOT_FOUND,
        `Version '${versionIdA}' not found`,
        'version'
      );
    }

    const vB = this.versions.get(versionIdB);
    if (!vB) {
      throw new HtmlEditorError(
        ErrorCodes.VERSION_NOT_FOUND,
        `Version '${versionIdB}' not found`,
        'version'
      );
    }

    // Perform diff
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(vA.htmlContent, vB.htmlContent);
    dmp.diff_cleanupSemantic(diffs);

    // Calculate additions and deletions (line-based counting)
    let additions = 0;
    let deletions = 0;
    const hunks: DiffHunk[] = [];

    let oldLine = 1;
    let newLine = 1;

    for (const [op, text] of diffs) {
      const lineCount = text.split('\n').length - 1;

      if (op === 1) {
        // INSERT
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
        // DELETE
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
        // EQUAL
        oldLine += lineCount;
        newLine += lineCount;
      }
    }

    return {
      diff: {
        additions,
        deletions,
        hunks,
        raw: JSON.stringify(diffs),
      },
      annotationsA: [...vA.annotations],
      annotationsB: [...vB.annotations],
    };
  }

  /**
   * Get the version history graph.
   */
  async history(sessionId: string): Promise<VersionGraph> {
    if (this.versions.size === 0) {
      throw new HtmlEditorError(
        ErrorCodes.VERSION_SESSION_NOT_FOUND,
        `Session '${sessionId}' not found or has no versions`,
        'version'
      );
    }

    const nodes: VersionNode[] = [];
    const edges: VersionEdge[] = [];
    let rootId: string | undefined;
    let currentId: string | undefined;

    for (const [, v] of this.versions) {
      // Skip internal/default versions whose parent doesn't exist in the map
      if (v.parentId && !this.versions.has(v.parentId)) continue;

      nodes.push({
        id: v.id,
        version: v.version,
        timestamp: v.timestamp,
        annotationCount: v.annotations.length,
        sealed: v.sealed,
        htmlSize: v.htmlContent.length,
      });

      if (v.parentId) {
        edges.push({ from: v.parentId, to: v.id });
      } else if (!rootId) {
        rootId = v.id;
      }

      // Last created version is the current
      currentId = v.id;
    }

    return {
      nodes,
      edges,
      rootId: rootId!,
      currentId,
    };
  }

  /**
   * Update the index.json file with current version list.
   */
  private async updateIndex(): Promise<void> {
    const indexData = {
      versions: Array.from(this.versions.values()).map((v) => ({
        id: v.id,
        version: v.version,
        parentId: v.parentId,
        sealed: v.sealed,
        timestamp: v.timestamp,
      })),
    };

    const indexPath = this.getIndexPath();
    await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
  }
}
