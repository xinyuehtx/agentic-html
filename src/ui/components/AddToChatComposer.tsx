import { useEffect, useRef, useState } from 'react';
import type { ElementCapture } from '../hooks/useElementCapture';
import { toDataUrl } from '../utils/toDataUrl';

export interface AddToChatComposerProps {
  capture: ElementCapture;
  /** Confirm with an optional note. */
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

/** Clamp the popover so it stays within the preview area. */
function clampPosition(x: number, y: number) {
  const width = 280;
  const left = Math.min(Math.max(x - width / 2, 8), Math.max(window.innerWidth - width - 8, 8));
  const top = Math.max(y + 14, 56);
  return { left, top, width };
}

/**
 * AddToChatComposer — inline popover shown after clicking an element in select
 * mode. Lets the user attach an optional note before adding the element to the
 * agent context. Ctrl/Cmd+Enter confirms; Escape cancels.
 */
export function AddToChatComposer({ capture, onConfirm, onCancel }: AddToChatComposerProps) {
  const [note, setNote] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pos = clampPosition(capture.anchorX, capture.anchorY);
  const thumb = toDataUrl(capture.screenshot);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onConfirm(note.trim());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      className="add-to-chat"
      style={{ position: 'absolute', left: pos.left, top: pos.top, width: pos.width }}
      role="dialog"
      aria-label="Add element to chat"
      onKeyDown={handleKeyDown}
    >
      <div className="add-to-chat__header">
        <span className="add-to-chat__icon" aria-hidden>⊹</span>
        <span className="add-to-chat__selector" title={capture.selector}>{capture.selector}</span>
      </div>

      {thumb && (
        <img className="add-to-chat__thumb" src={thumb} alt="Element preview" />
      )}

      <textarea
        ref={textareaRef}
        className="add-to-chat__textarea"
        placeholder="Add a note for the agent (optional)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />

      <div className="add-to-chat__actions">
        <button className="add-to-chat__btn add-to-chat__btn--cancel" onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="add-to-chat__btn add-to-chat__btn--add"
          onClick={() => onConfirm(note.trim())}
          type="button"
        >
          Add to chat
        </button>
      </div>
      <div className="add-to-chat__hint">⌘/Ctrl+Enter to add · Esc to cancel</div>
    </div>
  );
}
