import { useState } from 'react';

export interface AnnotationEditorProps {
  /** Initial comment text */
  initialComment: string;
  /** Save callback */
  onSave: (comment: string) => void;
  /** Cancel callback */
  onCancel: () => void;
}

/**
 * AnnotationEditor - inline editor for annotation comments.
 * Displays a textarea with save/cancel actions.
 */
export function AnnotationEditor({ initialComment, onSave, onCancel }: AnnotationEditorProps) {
  const [comment, setComment] = useState(initialComment);

  const handleSave = () => {
    const trimmed = comment.trim();
    if (trimmed) {
      onSave(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="annotation-editor">
      <textarea
        className="annotation-editor__textarea"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter comment..."
        autoFocus
        rows={3}
      />
      <div className="annotation-editor__actions">
        <button
          className="annotation-editor__btn annotation-editor__btn--save"
          onClick={handleSave}
          disabled={!comment.trim()}
        >
          Save
        </button>
        <button
          className="annotation-editor__btn annotation-editor__btn--cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
