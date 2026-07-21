/**
 * MCP Gateway tool definitions, validation, and handler routing.
 */

import { PreviewService } from '../../core/preview.service.js';
import { AnnotationService } from '../../core/annotation.service.js';
import { PatchService } from '../../core/patch.service.js';
import { SnapshotService } from '../../core/snapshot.service.js';
import { VersionService } from '../../core/version.service.js';
import { HtmlEditorError } from '../../core/errors.js';
import type { Patch, PatchAction } from '../../core/types.js';

/** MCP content item */
export interface McpContent {
  type: 'text';
  text: string;
}

/** MCP tool call result */
export interface ToolResult {
  content: McpContent[];
  isError?: boolean;
}

const VALID_PATCH_ACTIONS: PatchAction[] = ['replace', 'delete', 'insert_before', 'insert_after', 'modify_style'];
const VALID_ANNOTATION_STATUSES = ['pending', 'resolved'];

/**
 * Creates a success result with JSON-serialized data.
 */
function success(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

/**
 * Creates an error result with a message.
 */
function error(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/**
 * Wraps a caught error into a ToolResult.
 * Returns JSON format for HtmlEditorError to support structured error handling.
 */
export function wrapError(err: unknown, services?: Services): ToolResult {
  if (err instanceof HtmlEditorError) {
    const errorObj: Record<string, unknown> = {
      code: err.code,
      message: err.message,
    };
    // Include available versions for version-not-found errors
    if (err.code.includes('VERSION_NOT_FOUND') && services) {
      const versions = Array.from(
        (services.annotationService as any).versionStore?.keys?.() || []
      );
      errorObj.available_versions = versions;
    }
    if (err.context) {
      Object.assign(errorObj, err.context);
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(errorObj) }],
      isError: true,
    };
  }
  if (err instanceof Error) {
    return error(JSON.stringify({ code: 'INTERNAL_ERROR', message: err.message }));
  }
  return error(JSON.stringify({ code: 'UNKNOWN_ERROR', message: String(err) }));
}

/** Services container */
export interface Services {
  previewService: PreviewService;
  annotationService: AnnotationService;
  patchService: PatchService;
  snapshotService: SnapshotService;
  versionService: VersionService;
}

/**
 * Handle a tool call by name, performing validation and routing.
 */
export async function handleTool(
  name: string,
  params: Record<string, unknown>,
  services: Services
): Promise<ToolResult> {
  switch (name) {
    case 'preview_html':
      return handlePreviewHtml(params, services);
    case 'get_annotations':
      return handleGetAnnotations(params, services);
    case 'apply_patch':
      return handleApplyPatch(params, services);
    case 'get_dom_snapshot':
      return handleGetDomSnapshot(params, services);
    case 'get_version_history':
      return handleGetVersionHistory(params, services);
    case 'checkout_version':
      return handleCheckoutVersion(params, services);
    case 'create_version':
      return handleCreateVersion(params, services);
    case 'compare_versions':
      return handleCompareVersions(params, services);
    case 'close_preview':
      return handleClosePreview(params, services);
    default:
      return error(`unknown tool: '${name}'`);
  }
}

// ==================== Tool Handlers ====================

async function handlePreviewHtml(
  params: Record<string, unknown>,
  services: Services
): Promise<ToolResult> {
  // Validate file_path
  if (params.file_path === undefined || params.file_path === null) {
    return error('Missing required parameter: file_path');
  }
  if (typeof params.file_path !== 'string') {
    return error('Parameter file_path must be a string');
  }

  const filePath = params.file_path;
  const options: { port?: number; watch?: boolean } = {};
  if (params.port !== undefined) options.port = params.port as number;
  if (params.watch !== undefined) options.watch = params.watch as boolean;

  try {
    const session = await services.previewService.start(filePath, options);
    return success({
      url: session.url,
      session_id: session.sessionId,
      version_id: session.versionId,
      has_errors: session.hasErrors || false,
    });
  } catch (err) {
    return wrapError(err, services);
  }
}

async function handleGetAnnotations(
  params: Record<string, unknown>,
  services: Services
): Promise<ToolResult> {
  // Validate version_id
  if (params.version_id === undefined || params.version_id === null) {
    return error('Missing required parameter: version_id');
  }
  if (typeof params.version_id !== 'string') {
    return error('Parameter version_id must be a string');
  }

  // Validate optional status
  if (params.status !== undefined) {
    if (!VALID_ANNOTATION_STATUSES.includes(params.status as string)) {
      return error(`Invalid status value: '${params.status}'. Must be one of: ${VALID_ANNOTATION_STATUSES.join(', ')}`);
    }
  }

  const versionId = params.version_id;

  try {
    const annotations = await services.annotationService.getAll(versionId);
    return success({
      annotations,
      version: versionId,
    });
  } catch (err) {
    if (err instanceof HtmlEditorError && err.code === 'ANNOTATION_VERSION_NOT_FOUND') {
      // Check if version exists in VersionService (annotations may be on 'working' layer)
      const version = await services.versionService.get(versionId);
      if (version) {
        try {
          const annotations = await services.annotationService.getAll('working');
          return success({ annotations, version: versionId });
        } catch {
          return success({ annotations: [], version: versionId });
        }
      }
    }
    return wrapError(err, services);
  }
}

async function handleApplyPatch(
  params: Record<string, unknown>,
  services: Services
): Promise<ToolResult> {
  // Validate version_id
  if (params.version_id === undefined || params.version_id === null) {
    return error('Missing required parameter: version_id');
  }

  // Validate patches
  if (params.patches === undefined || params.patches === null) {
    return error('Missing required parameter: patches');
  }
  if (!Array.isArray(params.patches)) {
    return error('Parameter patches must be an array');
  }

  // Validate each patch object
  for (const patch of params.patches) {
    if (!patch.annotation_id) {
      return error('Each patch must have annotation_id');
    }
    if (!patch.action) {
      return error('Each patch must have action');
    }
    if (!VALID_PATCH_ACTIONS.includes(patch.action as PatchAction)) {
      return error(`Invalid action: '${patch.action}'. Must be one of: ${VALID_PATCH_ACTIONS.join(', ')}`);
    }
  }

  const versionId = params.version_id as string;

  // Convert snake_case params to camelCase for core service
  const patches: Patch[] = (params.patches as any[]).map((p) => ({
    annotationId: p.annotation_id,
    selector: p.selector,
    action: p.action,
    content: p.content,
    oldContent: p.old_content,
  }));

  try {
    const result = await services.patchService.apply(versionId, patches);
    return success({
      new_version_id: result.newVersionId,
      diff: result.diff.raw || JSON.stringify(result.diff),
      applied_count: result.appliedPatches,
      failed_patches: result.failedPatches,
    });
  } catch (err) {
    return wrapError(err, services);
  }
}

async function handleGetDomSnapshot(
  params: Record<string, unknown>,
  services: Services
): Promise<ToolResult> {
  // Validate version_id
  if (params.version_id === undefined || params.version_id === null) {
    return error('Missing required parameter: version_id');
  }
  if (typeof params.version_id !== 'string') {
    return error('Parameter version_id must be a string');
  }

  const versionId = params.version_id;
  const selector = params.selector as string | undefined;

  try {
    const snapshot = await services.snapshotService.get(versionId, selector);
    return success({
      html: snapshot.html,
      tree: snapshot.tree,
    });
  } catch (err) {
    return wrapError(err, services);
  }
}

async function handleGetVersionHistory(
  params: Record<string, unknown>,
  services: Services
): Promise<ToolResult> {
  // Validate session_id
  if (params.session_id === undefined || params.session_id === null) {
    return error('Missing required parameter: session_id');
  }
  if (typeof params.session_id !== 'string') {
    return error('Parameter session_id must be a string');
  }

  const sessionId = params.session_id;

  try {
    const graph = await services.versionService.history(sessionId);
    return success({
      versions: graph.nodes,
      graph,
    });
  } catch (err) {
    return wrapError(err, services);
  }
}

async function handleCheckoutVersion(
  params: Record<string, unknown>,
  services: Services
): Promise<ToolResult> {
  // Validate version_id
  if (params.version_id === undefined || params.version_id === null) {
    return error('Missing required parameter: version_id');
  }
  if (typeof params.version_id !== 'string') {
    return error('Parameter version_id must be a string');
  }

  const versionId = params.version_id;
  const options: { keepAnnotations?: boolean } = {};
  if (params.keep_annotations !== undefined) {
    options.keepAnnotations = params.keep_annotations as boolean;
  }

  try {
    const version = await services.versionService.checkout(versionId, options);
    return success({
      working_version_id: version.id,
    });
  } catch (err) {
    return wrapError(err, services);
  }
}

async function handleCreateVersion(
  params: Record<string, unknown>,
  services: Services
): Promise<ToolResult> {
  // Validate parent_id
  if (params.parent_id === undefined || params.parent_id === null) {
    return error('Missing required parameter: parent_id');
  }
  if (typeof params.parent_id !== 'string') {
    return error('Parameter parent_id must be a string');
  }

  // Validate html_content
  if (params.html_content === undefined || params.html_content === null) {
    return error('Missing required parameter: html_content');
  }
  if (typeof params.html_content !== 'string') {
    return error('Parameter html_content must be a string');
  }

  const parentId = params.parent_id;
  const htmlContent = params.html_content;
  const metadata = params.metadata as Record<string, unknown> | undefined;

  try {
    const version = await services.versionService.create({
      parentId,
      htmlContent,
      metadata: metadata as any,
    });
    return success({
      version_id: version.id,
    });
  } catch (err) {
    return wrapError(err, services);
  }
}

async function handleCompareVersions(
  params: Record<string, unknown>,
  services: Services
): Promise<ToolResult> {
  // Validate version_a
  if (params.version_a === undefined || params.version_a === null) {
    return error('Missing required parameter: version_a');
  }
  if (typeof params.version_a !== 'string') {
    return error('Parameter version_a must be a string');
  }

  // Validate version_b
  if (params.version_b === undefined || params.version_b === null) {
    return error('Missing required parameter: version_b');
  }
  if (typeof params.version_b !== 'string') {
    return error('Parameter version_b must be a string');
  }

  const versionA = params.version_a;
  const versionB = params.version_b;

  try {
    const result = await services.versionService.compare(versionA, versionB);
    return success({
      diff: result.diff,
      annotations_a: result.annotationsA,
      annotations_b: result.annotationsB,
    });
  } catch (err) {
    return wrapError(err, services);
  }
}

async function handleClosePreview(
  params: Record<string, unknown>,
  services: Services
): Promise<ToolResult> {
  // Validate session_id
  if (params.session_id === undefined || params.session_id === null) {
    return error('Missing required parameter: session_id');
  }
  if (typeof params.session_id !== 'string') {
    return error('Parameter session_id must be a string');
  }

  const sessionId = params.session_id;

  try {
    await services.previewService.stop(sessionId);
    return success({ success: true });
  } catch (err) {
    return wrapError(err, services);
  }
}
