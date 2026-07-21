/**
 * MCP Gateway notification definitions and push logic.
 */

import type { Annotation } from '../../core/types.js';

/** Notification message structure */
export interface McpNotification {
  method: string;
  params: Record<string, unknown>;
}

/** Notification handler function type */
export type NotificationSender = (notification: McpNotification) => void;

/**
 * Build and send the annotations_submitted notification.
 */
export function buildAnnotationsSubmittedNotification(
  sessionId: string,
  versionId: string,
  annotations: Annotation[],
  exportMarkdown: string
): McpNotification {
  return {
    method: 'notifications/annotations_submitted',
    params: {
      session_id: sessionId,
      version_id: versionId,
      annotations,
      export_markdown: exportMarkdown,
    },
  };
}
