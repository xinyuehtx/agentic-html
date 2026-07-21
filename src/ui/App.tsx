import { useRef, useEffect, useCallback, useState } from 'react';
import { PreviewFrame, PreviewFrameHandle } from './components/PreviewFrame';
import { Overlay } from './components/Overlay';
import { Toolbar } from './components/Toolbar';
import { VersionGraph } from './components/VersionGraph';
import { VersionDiffModal } from './components/VersionDiffModal';
import { HtmlErrorBanner, HtmlError } from './components/HtmlErrorBanner';
import { usePreviewSession } from './hooks/usePreviewSession';
import { useAppState, AppStateProvider } from './hooks/useAppState';
import { useVersionGraph } from './hooks/useVersionGraph';
import { isDemoMode, isDemoErrors, DEMO_HTML_ERRORS } from './demoData';

/**
 * AppInner - Main preview page layout with state-machine-driven interactions.
 */
function AppInner() {
  const previewRef = useRef<PreviewFrameHandle>(null);
  const { htmlContent, loading, error, connected, versionId, sessionId } = usePreviewSession();
  const {
    mode,
    phase,
    startPreviewing,
    startSubmitting,
    finishSubmitting,
    setHasHtmlErrors,
    setCurrentVersion,
    versionGraphOpen,
  } = useAppState();

  const versionGraph = useVersionGraph();
  const [htmlErrors, setHtmlErrors] = useState<HtmlError[]>([]);

  // Transition idle → previewing when content loads
  useEffect(() => {
    if (htmlContent && phase === 'idle') {
      startPreviewing();
    }
  }, [htmlContent, phase, startPreviewing]);

  // Update current version in state machine
  useEffect(() => {
    if (versionId) {
      setCurrentVersion(versionId, false);
    }
  }, [versionId, setCurrentVersion]);

  // Detect HTML errors (simplified: check for common parse error indicators)
  useEffect(() => {
    if (isDemoMode() && isDemoErrors()) {
      setHtmlErrors(DEMO_HTML_ERRORS);
      setHasHtmlErrors(true);
      return;
    }
    if (!htmlContent) {
      setHtmlErrors([]);
      setHasHtmlErrors(false);
      return;
    }
    // In real implementation, this would come from PreviewService has_errors field
    // For now, we maintain the errors array as empty unless backend signals errors
    setHasHtmlErrors(htmlErrors.length > 0);
  }, [htmlContent, htmlErrors, setHasHtmlErrors]);

  // Handle submit annotations
  const handleSubmit = useCallback(async () => {
    if (phase === 'submitting') return;
    startSubmitting();
    try {
      await fetch('/api/annotations/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, versionId }),
      });
    } catch {
      // Error handling - could show toast
    } finally {
      finishSubmitting();
    }
  }, [phase, sessionId, versionId, startSubmitting, finishSubmitting]);

  // Handle error feedback to agent
  const handleErrorFeedback = useCallback(async (errors: HtmlError[]) => {
    try {
      await fetch('/api/errors/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, versionId, errors }),
      });
    } catch {
      // Silently fail
    }
  }, [sessionId, versionId]);

  // Determine overlay mode based on app state
  const overlayMode = (mode === 'ink' || mode === 'select') ? 'annotate' : 'browse';

  return (
    <div className="app-layout">
      {/* Toolbar */}
      <Toolbar connected={connected} onSubmit={handleSubmit} />

      {/* HTML Error Banner */}
      {htmlErrors.length > 0 && (
        <HtmlErrorBanner errors={htmlErrors} onFeedback={handleErrorFeedback} />
      )}

      {/* Main content */}
      <main className="app-content">
        {/* Preview area: iframe + overlay */}
        <div className="preview-area">
          {loading && (
            <div style={{ padding: 16, color: '#64748b' }}>Loading preview...</div>
          )}
          {error && (
            <div style={{ padding: 16, color: '#ef4444' }}>Error: {error}</div>
          )}
          <PreviewFrame ref={previewRef} htmlContent={htmlContent} />
          <Overlay mode={overlayMode} />
        </div>

        {/* Sidebar */}
        <aside className="app-sidebar">
          <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>
            {versionId ? `Version: ${versionId}` : 'No version loaded'}
          </div>
        </aside>

        {/* Version Graph Panel */}
        <VersionGraph sessionId={sessionId} versionGraph={versionGraph} />
      </main>

      {/* Version Diff Modal */}
      {versionGraph.diff && (
        <VersionDiffModal
          diff={versionGraph.diff}
          loading={versionGraph.diffLoading}
          onClose={versionGraph.clearDiff}
        />
      )}
    </div>
  );
}

/**
 * App - Root component wrapped with AppStateProvider.
 */
export function App() {
  return (
    <AppStateProvider>
      <AppInner />
    </AppStateProvider>
  );
}
