import { useState, useEffect, useCallback } from 'react';
import { useWebSocket, WSMessage } from './useWebSocket';
import { isDemoMode, DEMO_HTML_CONTENT, DEMO_SESSION_ID, DEMO_VERSION_ID } from '../demoData';

/** Preview session state */
export interface PreviewSessionState {
  sessionId: string | null;
  versionId: string | null;
  htmlContent: string | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
}

/**
 * Preview session management hook.
 * - Reads sessionId and versionId from URL parameters
 * - Fetches version HTML via /api/snapshot/:versionId
 * - Listens to WebSocket reload messages to refresh content
 * - In demo mode (?demo=true), returns mock data without API calls
 */
export function usePreviewSession(): PreviewSessionState {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoMode = isDemoMode();
  const { connected, lastMessage } = useWebSocket({ disabled: demoMode });

  // Extract URL params on mount (or use demo defaults)
  useEffect(() => {
    if (demoMode) {
      setSessionId(DEMO_SESSION_ID);
      setVersionId(DEMO_VERSION_ID);
      setHtmlContent(DEMO_HTML_CONTENT);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('sessionId');
    const vid = params.get('versionId');
    setSessionId(sid);
    setVersionId(vid);
  }, [demoMode]);

  // Fetch HTML content for a given versionId
  const fetchSnapshot = useCallback(async (vid: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/snapshot/${vid}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch snapshot: ${response.status}`);
      }
      const html = await response.text();
      setHtmlContent(html);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on initial versionId (skip in demo mode)
  useEffect(() => {
    if (demoMode) return;
    if (versionId) {
      fetchSnapshot(versionId);
    }
  }, [versionId, fetchSnapshot, demoMode]);

  // Handle WebSocket messages (skip in demo mode)
  useEffect(() => {
    if (demoMode) return;
    if (!lastMessage) return;

    const msg = lastMessage as WSMessage;

    if (msg.type === 'reload') {
      // Reload current version content
      if (versionId) {
        fetchSnapshot(versionId);
      }
    } else if (msg.type === 'version_changed') {
      // Switch to a new version
      const newVersionId = msg.versionId as string | undefined;
      if (newVersionId) {
        setVersionId(newVersionId);
      }
    }
  }, [lastMessage, versionId, fetchSnapshot]);

  return {
    sessionId,
    versionId,
    htmlContent,
    loading,
    error,
    connected,
  };
}
