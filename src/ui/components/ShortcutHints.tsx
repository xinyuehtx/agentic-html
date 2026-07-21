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
    <div
      className="shortcut-hints"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: '6px 16px',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        zIndex: 9999,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <span>{mod}+Enter Submit</span>
      <span style={{ opacity: 0.4 }}>|</span>
      <span>Esc Cancel</span>
      <span style={{ opacity: 0.4 }}>|</span>
      <span>1/2/3 Mode</span>
      <span style={{ opacity: 0.4 }}>|</span>
      <span>Del Delete</span>
      <span style={{ opacity: 0.4 }}>|</span>
      <span>{mod}+A Select All</span>
    </div>
  );
}
