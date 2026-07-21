import { useEffect } from 'react';
import type { AppMode, AppPhase } from './useAppState';

export interface UseKeyboardShortcutsOptions {
  appState: {
    mode: AppMode;
    phase: AppPhase;
    sealed: boolean;
  };
  onModeChange: (mode: AppMode) => void;
  onSubmit: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
}

/**
 * Returns true if the currently focused element is an input-like element
 * where keyboard shortcuts should not interfere.
 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tagName = el.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * useKeyboardShortcuts - Global keydown listener for app-wide shortcuts.
 *
 * Shortcuts:
 *   Ctrl/Cmd+Enter  → Submit
 *   Escape          → Switch to browse mode
 *   1               → Browse mode
 *   2               → Ink mode
 *   3               → Select mode
 *   Delete/Backspace → Delete
 *   Ctrl/Cmd+A      → Select all
 *
 * Disabled when:
 *   - An input/textarea/contenteditable is focused
 *   - phase === 'submitting' (except Escape)
 */
export function useKeyboardShortcuts({
  appState,
  onModeChange,
  onSubmit,
  onDelete,
  onSelectAll,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip when input elements are focused
      if (isInputFocused()) return;

      const { phase } = appState;
      const hasModifier = e.ctrlKey || e.metaKey;

      // Escape is always allowed (even during submitting)
      if (e.code === 'Escape') {
        e.preventDefault();
        onModeChange('browse');
        return;
      }

      // Block all other shortcuts while submitting
      if (phase === 'submitting') return;

      // Ctrl/Cmd+Enter → Submit
      if (hasModifier && e.code === 'Enter') {
        e.preventDefault();
        onSubmit();
        return;
      }

      // Ctrl/Cmd+A → Select all
      if (hasModifier && e.code === 'KeyA') {
        e.preventDefault();
        onSelectAll();
        return;
      }

      // Number keys for mode switching (only without modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        switch (e.code) {
          case 'Digit1':
            e.preventDefault();
            onModeChange('browse');
            return;
          case 'Digit2':
            e.preventDefault();
            onModeChange('ink');
            return;
          case 'Digit3':
            e.preventDefault();
            onModeChange('select');
            return;
          case 'Delete':
          case 'Backspace':
            e.preventDefault();
            onDelete();
            return;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [appState, onModeChange, onSubmit, onDelete, onSelectAll]);
}
