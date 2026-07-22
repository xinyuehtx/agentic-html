import { useMemo } from 'react';

/**
 * ShortcutHints - Displays a bar of keyboard shortcut hints at the bottom of the screen.
 * Detects macOS to show ⌘ instead of Ctrl.
 */
export function ShortcutHints() {
  const isMac = useMemo(() => {
    return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }, []);

  const mod = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="shortcut-hints">
      <span><kbd>{mod}+Enter</kbd> Submit</span>
      <span className="shortcut-hints__sep">|</span>
      <span><kbd>Esc</kbd> Cancel</span>
      <span className="shortcut-hints__sep">|</span>
      <span><kbd>1/2/3</kbd> Mode</span>
      <span className="shortcut-hints__sep">|</span>
      <span><kbd>Del</kbd> Delete</span>
      <span className="shortcut-hints__sep">|</span>
      <span><kbd>{mod}+A</kbd> Select All</span>
    </div>
  );
}
