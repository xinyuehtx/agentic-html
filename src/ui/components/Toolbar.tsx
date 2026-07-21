import { useAppState, AppMode } from '../hooks/useAppState';

interface ToolbarProps {
  connected: boolean;
  onSubmit: () => void;
}

/**
 * Toolbar - top toolbar with mode switching, submit, version info, and controls.
 */
export function Toolbar({ connected, onSubmit }: ToolbarProps) {
  const {
    mode,
    phase,
    setMode,
    hasHtmlErrors,
    currentVersionId,
    sealed,
    versionGraphOpen,
    toggleVersionGraph,
  } = useAppState();

  const isSubmitting = phase === 'submitting';
  const canAnnotate = phase === 'previewing' || phase === 'annotating';

  const modes: { key: AppMode; label: string }[] = [
    { key: 'browse', label: 'Browse' },
    { key: 'ink', label: 'Ink' },
    { key: 'select', label: 'Select' },
  ];

  return (
    <header className="toolbar">
      <span className="toolbar__brand">Agentic HTML</span>

      {/* Mode switcher */}
      <div className="toolbar__mode-group">
        {modes.map(({ key, label }) => (
          <button
            key={key}
            className={`toolbar__mode-btn ${mode === key ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => setMode(key)}
            disabled={isSubmitting || (!canAnnotate && key !== 'browse')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Submit button */}
      <button
        className="toolbar__btn toolbar__btn--primary"
        onClick={onSubmit}
        disabled={isSubmitting || phase === 'idle'}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Annotations'}
      </button>

      {/* HTML error indicator */}
      {hasHtmlErrors && (
        <button className="toolbar__btn toolbar__btn--danger" disabled>
          HTML Errors
        </button>
      )}

      <div className="toolbar__spacer" />

      {/* Version info */}
      {currentVersionId && (
        <div className="toolbar__version-info">
          <span className="toolbar__version-badge">
            v{currentVersionId.slice(0, 8)}
          </span>
          {sealed && <span className="toolbar__sealed-icon" title="Sealed">🔒</span>}
        </div>
      )}

      {/* Version Graph toggle */}
      <button
        className={`toolbar__btn ${versionGraphOpen ? 'toolbar__btn--active' : ''}`}
        onClick={toggleVersionGraph}
      >
        Versions
      </button>

      {/* Connection status */}
      <span className="toolbar__status">
        <span
          className={`toolbar__status-dot ${
            connected
              ? 'toolbar__status-dot--connected'
              : 'toolbar__status-dot--disconnected'
          }`}
        />
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </header>
  );
}
