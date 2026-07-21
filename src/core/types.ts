/**
 * Core type definitions for agentic-html
 * All types are JSON-serializable for MCP transport compatibility.
 */

// ==================== DOM & Position ====================

/** CSS selector-based DOM position */
export interface DOMPosition {
  selector: string;
  textOffset?: { start: number; end: number };
}

/** Element hit by ink region detection */
export interface HitElement {
  selector: string;
  tag: string;
  outerHtmlSummary: string;
  boundingRect: { x: number; y: number; width: number; height: number };
}

/** Rectangular ink region drawn by user */
export interface InkRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ==================== Annotation ====================

/** Annotation status */
export type AnnotationStatus = 'pending' | 'resolved';

/** Annotation on an HTML element */
export interface Annotation {
  id: string;
  anchor_element: DOMPosition;
  comment: string;
  status: AnnotationStatus;
  timestamp: string;
  version_id: string;
  screenshot?: string;
  hit_elements?: HitElement[];
}

// ==================== Version ====================

/** Version metadata from agent */
export interface VersionMetadata {
  agent?: string;
  promptSummary?: string;
}

/** A versioned snapshot of the HTML document */
export interface Version {
  id: string;
  version: string;
  parentId: string | null;
  htmlContent: string;
  htmlFile?: string;
  annotations: Annotation[];
  sealed: boolean;
  timestamp: string;
  metadata?: VersionMetadata;
}

/** Result of comparing two versions */
export interface VersionCompareResult {
  diff: VersionDiff;
  annotationsA: Annotation[];
  annotationsB: Annotation[];
}

/** Options for creating a new version */
export interface VersionCreateOptions {
  parentId?: string | null;
  htmlContent: string;
  annotations?: Annotation[];
  sealed?: boolean;
  metadata?: VersionMetadata;
  sessionId?: string;
}

/** Node in version graph visualization */
export interface VersionNode {
  id: string;
  version: string;
  timestamp: string;
  annotationCount: number;
  sealed: boolean;
  htmlSize: number;
}

/** Edge in version graph */
export interface VersionEdge {
  from: string;
  to: string;
}

/** Version graph structure */
export interface VersionGraph {
  nodes: VersionNode[];
  edges: VersionEdge[];
  rootId: string;
  currentId?: string;
}

/** Diff hunk between two versions */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

/** Diff result between two versions */
export interface VersionDiff {
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  raw: string;
}

// ==================== Patch ====================

/** Supported patch actions */
export type PatchAction = 'replace' | 'delete' | 'insert_before' | 'insert_after' | 'modify_style';

/** A patch operation on the DOM */
export interface Patch {
  annotationId?: string;
  selector: string;
  action: PatchAction;
  content?: string;
  oldContent?: string;
}

/** Information about a failed patch */
export interface PatchFailure {
  patch: Patch;
  reason: string;
}

/** Result of applying patches */
export interface PatchResult {
  newVersionId: string;
  diff: VersionDiff;
  appliedPatches: number;
  failedPatches: PatchFailure[];
  verification?: VerificationResult;
}

/** Result of previewing patches without applying */
export interface PatchPreviewResult {
  previewHtml: string;
  diff: VersionDiff;
  appliedPatches?: number;
  failedPatches?: PatchFailure[];
}

// ==================== Preview ====================

/** Active preview session */
export interface PreviewSession {
  sessionId: string;
  url: string;
  port: number;
  filePath: string;
  versionId: string;
  createdAt: string;
  hasErrors?: boolean;
}

/** Options for starting a preview */
export interface PreviewOptions {
  port?: number;
  watch?: boolean;
}

// ==================== Snapshot ====================

/** Node in the DOM tree representation */
export interface DOMTreeNode {
  tag: string;
  selector: string;
  attributes: Record<string, string>;
  textContent: string;
  children: DOMTreeNode[];
  boundingRect?: { x: number; y: number; width: number; height: number };
}

/** DOM snapshot of a version */
export interface DOMSnapshot {
  html: string;
  tree: DOMTreeNode;
}

/** Options for hit testing */
export interface HitTestOptions {
  bounds: InkRegion;
  threshold?: number;
}

/** Result of hit testing */
export interface HitTestResult {
  elements: HitElement[];
  anchorElement?: DOMPosition;
  screenshotBase64?: string;
}

// ==================== Annotation Input ====================

/** Data for creating a new annotation */
export interface CreateAnnotationData {
  anchor_element: DOMPosition;
  comment: string;
  screenshot?: string;
  hit_elements?: HitElement[];
}

// ==================== Annotation Export ====================

/** Options for exporting annotations */
export interface AnnotationExportOptions {
  format: 'markdown' | 'json';
  includeScreenshots?: boolean;
}

/** Result of annotation export */
export interface AnnotationExportResult {
  content: string;
  format: 'markdown' | 'json';
  annotationCount: number;
}

// ==================== HTML Error ====================

/** Structured HTML processing error */
export interface HtmlError {
  type: 'parse_error' | 'render_error' | 'resource_missing';
  message: string;
  location?: { line: number; column: number; context: string };
  filePath: string;
  versionId?: string;
}

// ==================== Verification ====================

/** Result of auto-verification after patch application */
export interface VerificationResult {
  passed: boolean;
  domComparison: DomComparisonResult;
  visualComparison: VisualComparisonResult | null;
  expectedChanges: DomChange[];
  unexpectedChanges: DomChange[];
  summary: string;
}

/** DOM comparison result */
export interface DomComparisonResult {
  totalChanges: number;
  additions: number;
  deletions: number;
  modifications: number;
  changes: DomChange[];
}

/** Visual (screenshot) comparison result */
export interface VisualComparisonResult {
  diffPercentage: number;
  diffImagePath: string | null;
  changedRegions: BoundingBox[];
  beforeScreenshot: string;
  afterScreenshot: string;
}

/** A single DOM change detected during verification */
export interface DomChange {
  type: 'added' | 'removed' | 'modified' | 'moved';
  selector: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  expected: boolean;
}

/** Bounding box for visual change regions */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
