/**
 * Error system for agentic-html
 * Provides structured error codes and a base error class for all modules.
 */

/** Base error class for the HTML Editor plugin */
export class HtmlEditorError extends Error {
  constructor(
    public code: string,
    message: string,
    public module: string,
    public severity: 'fatal' | 'error' | 'warning' = 'error',
    public recoverable: boolean = false,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HtmlEditorError';
  }
}

/** All error codes organized by module */
export const ErrorCodes = {
  // Preview
  PREVIEW_FILE_NOT_FOUND: 'PREVIEW_FILE_NOT_FOUND',
  PREVIEW_INVALID_FORMAT: 'PREVIEW_INVALID_FORMAT',
  PREVIEW_PORT_CONFLICT: 'PREVIEW_PORT_CONFLICT',
  PREVIEW_SESSION_NOT_FOUND: 'PREVIEW_SESSION_NOT_FOUND',
  PREVIEW_FILE_TOO_LARGE: 'PREVIEW_FILE_TOO_LARGE',
  // Annotation
  ANNOTATION_VERSION_NOT_FOUND: 'ANNOTATION_VERSION_NOT_FOUND',
  ANNOTATION_NOT_FOUND: 'ANNOTATION_NOT_FOUND',
  ANNOTATION_VERSION_SEALED: 'ANNOTATION_VERSION_SEALED',
  ANNOTATION_EMPTY: 'ANNOTATION_EMPTY',
  // Version
  VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
  VERSION_PARENT_NOT_FOUND: 'VERSION_PARENT_NOT_FOUND',
  VERSION_HTML_EMPTY: 'VERSION_HTML_EMPTY',
  VERSION_SESSION_NOT_FOUND: 'VERSION_SESSION_NOT_FOUND',
  VERSION_ALREADY_SEALED: 'VERSION_ALREADY_SEALED',
  // Patch
  PATCH_VERSION_NOT_FOUND: 'PATCH_VERSION_NOT_FOUND',
  PATCH_EMPTY: 'PATCH_EMPTY',
  PATCH_ALL_FAILED: 'PATCH_ALL_FAILED',
  PATCH_CONTENT_MISMATCH: 'PATCH_CONTENT_MISMATCH',
  PATCH_INVALID_ACTION: 'PATCH_INVALID_ACTION',
  // Snapshot
  SNAPSHOT_VERSION_NOT_FOUND: 'SNAPSHOT_VERSION_NOT_FOUND',
  SNAPSHOT_SELECTOR_INVALID: 'SNAPSHOT_SELECTOR_INVALID',
  SNAPSHOT_ELEMENT_NOT_FOUND: 'SNAPSHOT_ELEMENT_NOT_FOUND',
  SNAPSHOT_BOUNDS_INVALID: 'SNAPSHOT_BOUNDS_INVALID',
} as const;

/** Type helper for error code values */
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
