import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { PreviewFrame, PreviewFrameHandle } from './components/PreviewFrame';
import { Overlay } from './components/Overlay';
import { Toolbar } from './components/Toolbar';
import { AnnotationSidebar } from './components/AnnotationSidebar';
import { VersionGraph } from './components/VersionGraph';
import { VersionDiffModal } from './components/VersionDiffModal';
import { HtmlErrorBanner, HtmlError } from './components/HtmlErrorBanner';
import { AddToChatComposer } from './components/AddToChatComposer';
import { ElementHighlight } from './components/ElementHighlight';
import type { AnchorData } from './components/AnchorMarker';
import { usePreviewSession } from './hooks/usePreviewSession';
import { useAppState, AppStateProvider } from './hooks/useAppState';
import { useVersionGraph } from './hooks/useVersionGraph';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useInkAnnotation, type InkAnnotation } from './hooks/useInkAnnotation';
import { useElementCapture } from './hooks/useElementCapture';
import { AnnotationStoreProvider, useAnnotationStore } from './hooks/useAnnotationStore';
import { ShortcutHints } from './components/ShortcutHints';
import { isDemoMode, isDemoErrors, DEMO_HTML_ERRORS } from './demoData';

/**
 * AppInner - Main preview page layout with state-machine-driven interactions.
 */
function AppInner() {
  const previewRef = useRef<PreviewFrameHandle>(null);
  const iframeElRef = useRef<HTMLIFrameElement>(null);
  const { htmlContent, loading, error, connected, versionId, sessionId } = usePreviewSession();
  const {
    mode,
    phase,
    setMode,
    startPreviewing,
    startSubmitting,
    finishSubmitting,
    setHasHtmlErrors,
    setCurrentVersion,
  } = useAppState();

  const {
    annotations,
    sealed,
    add: addAnnotation,
    remove: removeAnnotation,
    removeMany,
    hydrate,
    sendToAgent,
    selection,
  } = useAnnotationStore();

  const versionGraph = useVersionGraph();
  const [htmlErrors, setHtmlErrors] = useState<HtmlError[]>([]);

  // Ink stroke pipeline feeds the shared annotation store.
  const handleInkComplete = useCallback(
    (a: InkAnnotation) => {
      addAnnotation({
        source: 'ink',
        anchor_element: a.anchor_element,
        screenshot: a.screenshot,
        hit_elements: a.hit_elements.map((h) => ({
          selector: h.selector,
          tag: '',
          outerHtmlSummary: '',
          boundingRect: { x: 0, y: 0, width: 0, height: 0 },
        })),
        anchor: a.anchor,
      });
    },
    [addAnnotation],
  );
  const ink = useInkAnnotation(iframeElRef, handleInkComplete);

  // Element capture ("add element to chat") — active only in select mode.
  const capture = useElementCapture(iframeElRef, mode === 'select');
  const handleAddElement = useCallback(
    (note: string) => {
      const c = capture.pending;
      if (!c) return;
      addAnnotation({
        source: 'element',
        anchor_element: { selector: c.selector },
        comment: note,
        screenshot: c.screenshot,
        hit_elements: [
          {
            selector: c.selector,
            tag: c.tag,
            outerHtmlSummary: c.outerHtmlSummary,
            boundingRect: c.rect,
          },
        ],
        anchor: { x: c.anchorX, y: c.anchorY },
      });
      capture.clearPending();
    },
    [capture, addAnnotation],
  );

  // Anchor markers derived from stored annotations that carry capture-time coords.
  const anchors: AnchorData[] = useMemo(
    () =>
      annotations
        .filter((a) => a.anchor)
        .map((a) => ({
          id: a.id,
          x: a.anchor!.x,
          y: a.anchor!.y,
          selector: a.anchor_element.selector,
          screenshot: a.screenshot,
          hitElementSelectors: a.hit_elements?.map((h) => h.selector),
          comment: a.comment,
        })),
    [annotations],
  );

  // Transition idle → previewing when content loads.
  useEffect(() => {
    if (htmlContent && phase === 'idle') startPreviewing();
  }, [htmlContent, phase, startPreviewing]);

  // Track current version and hydrate the annotation store.
  useEffect(() => {
    if (versionId) {
      setCurrentVersion(versionId, false);
      hydrate(versionId);
    }
  }, [versionId, setCurrentVersion, hydrate]);

  // Derive HTML errors (demo drives them; real errors would come from the backend).
  useEffect(() => {
    if (isDemoMode() && isDemoErrors()) {
      setHtmlErrors(DEMO_HTML_ERRORS);
    } else if (!htmlContent) {
      setHtmlErrors([]);
    }
  }, [htmlContent]);

  useEffect(() => {
    setHasHtmlErrors(htmlErrors.length > 0);
  }, [htmlErrors, setHasHtmlErrors]);

  // Submit / "send to agent".
  const handleSubmit = useCallback(async () => {
    if (phase === 'submitting') return;
    startSubmitting();
    try {
      await sendToAgent();
    } finally {
      finishSubmitting();
    }
  }, [phase, startSubmitting, finishSubmitting, sendToAgent]);

  // Keyboard shortcuts.
  useKeyboardShortcuts({
    appState: { mode, phase, sealed },
    onModeChange: setMode,
    onSubmit: handleSubmit,
    onDelete: () => {
      if (selection.selectedCount > 0) {
        removeMany(Array.from(selection.selectedIds));
        selection.clearSelection();
      } else if (annotations.length > 0) {
        removeAnnotation(annotations[annotations.length - 1].id);
      }
    },
    onSelectAll: () => selection.selectAll(annotations.map((a) => a.id)),
  });

  // Error feedback to agent.
  const handleErrorFeedback = useCallback(
    async (errors: HtmlError[]) => {
      try {
        await fetch('/api/errors/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, versionId, errors }),
        });
      } catch {
        // best-effort
      }
    },
    [sessionId, versionId],
  );

  return (
    <div className="app-layout">
      <Toolbar connected={connected} onSubmit={handleSubmit} annotationCount={annotations.length} />

      {htmlErrors.length > 0 && (
        <HtmlErrorBanner errors={htmlErrors} onFeedback={handleErrorFeedback} />
      )}

      <main className="app-content">
        <div className="preview-area">
          {loading && <div className="preview-state">Loading preview…</div>}
          {error && <div className="preview-state preview-state--error">Error: {error}</div>}
          <PreviewFrame ref={previewRef} elementRef={iframeElRef} htmlContent={htmlContent} />
          <Overlay
            mode={mode}
            inkActive={mode === 'ink'}
            onStrokeComplete={ink.handleStrokeComplete}
            anchors={anchors}
            selectedAnchorId={null}
            iframeRef={iframeElRef}
          >
            {mode === 'select' && <ElementHighlight hovered={capture.hovered} />}
            {capture.pending && (
              <AddToChatComposer
                capture={capture.pending}
                onConfirm={handleAddElement}
                onCancel={capture.clearPending}
              />
            )}
          </Overlay>
        </div>

        <aside className="app-sidebar">
          <AnnotationSidebar previewRef={previewRef} />
        </aside>

        <VersionGraph sessionId={sessionId} versionGraph={versionGraph} />
      </main>

      <ShortcutHints />

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
 * App - Root component wrapped with providers.
 */
export function App() {
  return (
    <AppStateProvider>
      <AnnotationStoreProvider>
        <AppInner />
      </AnnotationStoreProvider>
    </AppStateProvider>
  );
}
