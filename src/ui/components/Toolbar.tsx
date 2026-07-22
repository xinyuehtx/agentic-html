import { useAppState, AppMode } from '../hooks/useAppState';
import { useTheme } from '../hooks/useTheme';

interface ToolbarProps {
  connected: boolean;
  onSubmit: () => void;
  /** Number of pending annotations (drives the submit badge). */
  annotationCount?: number;
}

/**
 * Toolbar - top toolbar with mode switching, submit, version info, theme toggle.
 */
export function Toolbar({ connected, onSubmit, annotationCount = 0 }: ToolbarProps) {
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
  const { theme, toggle: toggleTheme } = useTheme();

  const isSubmitting = phase === 'submitting';
  const canAnnotate = phase === 'previewing' || phase === 'annotating';

  const modes: { key: AppMode; label: string; hint: string }[] = [
    { key: 'browse', label: 'Browse', hint: 'Interact with the page (1)' },
    { key: 'ink', label: 'Ink', hint: 'Circle a region (2)' },
    { key: 'select', label: 'Select', hint: 'Add an element to chat (3)' },
  ];

  return (
    <header className="toolbar">
      <span className="toolbar__logo" aria-hidden />
      <span className="toolbar__brand">Agentic HTML</span>

      {/* Mode switcher */}
      <div className="toolbar__mode-group" role="group" aria-label="Annotation mode">
        {modes.map(({ key, label, hint }) => (
          <button
            key={key}
            className={`toolbar__mode-btn ${mode === key ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => setMode(key)}
            disabled={isSubmitting || (!canAnnotate && key !== 'browse')}
            title={hint}
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
        {isSubmitting ? 'Submitting…' : 'Submit Annotations'}
        {annotationCount > 0 && !isSubmitting && (
          <span className="toolbar__btn-badge">{annotationCount}</span>
        )}
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
          <span className="toolbar__version-badge">#{currentVersionId.slice(0, 8)}</span>
          {sealed && (
            <span className="toolbar__sealed-icon" title="Sealed">🔒</span>
          )}
        </div>
      )}

      {/* Version Graph toggle */}
      <button
        className={`toolbar__btn ${versionGraphOpen ? 'toolbar__btn--active' : ''}`}
        onClick={toggleVersionGraph}
      >
        Versions
      </button>

      {/* Theme toggle */}
      <button
        className="toolbar__icon-btn"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      {/* Connection status */}
      <span className="toolbar__status" title={connected ? 'Connected' : 'Disconnected'}>
        <span
          className={`toolbar__status-dot ${
            connected ? 'toolbar__status-dot--connected' : 'toolbar__status-dot--disconnected'
          }`}
        />
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </header>
  );
}
