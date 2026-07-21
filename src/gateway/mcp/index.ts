/**
 * MCP Gateway - entry point.
 * Provides the McpGateway class that validates tool calls,
 * routes to core services, and handles notifications.
 */

import { PreviewService } from '../../core/preview.service.js';
import { AnnotationService } from '../../core/annotation.service.js';
import { PatchService } from '../../core/patch.service.js';
import { SnapshotService } from '../../core/snapshot.service.js';
import { VersionService } from '../../core/version.service.js';
import { handleTool, type ToolResult, type Services } from './tools.js';
import {
  buildAnnotationsSubmittedNotification,
  type NotificationSender,
  type McpNotification,
} from './notifications.js';
import type { Annotation } from '../../core/types.js';

export class McpGateway {
  private services: Services;
  private notificationHandler: NotificationSender | null = null;

  constructor() {
    const versionService = new VersionService();
    this.services = {
      previewService: new PreviewService(versionService),
      annotationService: new AnnotationService(versionService),
      patchService: new PatchService(versionService),
      snapshotService: new SnapshotService(versionService),
      versionService,
    };
  }

  /**
   * Handle an MCP tool call by name and parameters.
   */
  async handleToolCall(
    name: string,
    params: Record<string, unknown>
  ): Promise<ToolResult> {
    return handleTool(name, params, this.services);
  }

  /**
   * Set the notification handler for pushing notifications.
   */
  setNotificationHandler(handler: NotificationSender): void {
    this.notificationHandler = handler;
  }

  /**
   * Push annotations_submitted notification.
   */
  async pushAnnotations(
    sessionId: string,
    versionId: string,
    annotations: Annotation[],
    exportMarkdown: string
  ): Promise<void> {
    if (this.notificationHandler) {
      const notification = buildAnnotationsSubmittedNotification(
        sessionId,
        versionId,
        annotations,
        exportMarkdown
      );
      this.notificationHandler(notification);
    }
  }

  /**
   * Push HTML error feedback notification to Agent.
   */
  async pushHtmlError(
    sessionId: string,
    error: {
      type: string;
      message: string;
      location?: { line: number; column: number; context: string };
      file_path?: string;
      version_id?: string;
    }
  ): Promise<void> {
    if (this.notificationHandler) {
      const notification: McpNotification = {
        method: 'notifications/html_error_feedback',
        params: {
          session_id: sessionId,
          error: {
            type: error.type,
            message: error.message,
            location: error.location,
            file_path: error.file_path,
            version_id: error.version_id,
          },
        },
      };
      this.notificationHandler(notification);
    }
  }
}
