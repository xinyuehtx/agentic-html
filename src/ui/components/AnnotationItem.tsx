import { useState } from 'react';
import { UIAnnotation } from '../hooks/useAnnotations';
import { AnnotationEditor } from './AnnotationEditor';

export interface AnnotationItemProps {
  /** The annotation data */
  annotation: UIAnnotation;
  /** 1-based index for display */
  index: number;
  /** Whether the version is sealed (read-only) */
  sealed: boolean;
  /** Click handler to scroll/highlight in iframe */
  onClick: (selector: string) => void;
  /** Update comment handler */
  onUpdate: (id: string, comment: string) => void;
  /** Delete handler */
  onDelete: (id: string) => void;
}

/**
 * AnnotationItem - single annotation card in the sidebar list.
 * Shows selector, comment preview, screenshot thumbnail, and action buttons.
 */
export function AnnotationItem({
  annotation,
  index,
  sealed,
  onClick,
  onUpdate,
  onDelete,
}: AnnotationItemProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const selectorDisplay = truncate(annotation.anchor_element.selector, 40);
  const commentPreview = annotation.comment.length > 80 && !expanded
    ? annotation.comment.slice(0, 80) + '...'
    : annotation.comment;

  const handleClick = () => {
    onClick(annotation.anchor_element.selector);
  };

  const handleSave = (newComment: string) => {
    onUpdate(annotation.id, newComment);
    setEditing(false);
  };

  return (
    <div className="annotation-item" onClick={handleClick}>
      <div className="annotation-item__header">
        <span className="annotation-item__index">#{index}</span>
        <span className="annotation-item__selector" title={annotation.anchor_element.selector}>
          {selectorDisplay}
        </span>
        <span className={`annotation-item__status annotation-item__status--${annotation.status}`}>
          {annotation.status}
        </span>
      </div>

      {/* Screenshot thumbnail */}
      {annotation.screenshot && (
        <div className="annotation-item__screenshot">
          <img
            src={`data:image/png;base64,${annotation.screenshot}`}
            alt="Annotation screenshot"
            className="annotation-item__screenshot-img"
          />
        </div>
      )}

      {/* Comment section */}
      {editing ? (
        <div onClick={(e) => e.stopPropagation()}>
          <AnnotationEditor
            initialComment={annotation.comment}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="annotation-item__comment">
          <p
            className="annotation-item__comment-text"
            onClick={(e) => {
              if (annotation.comment.length > 80) {
                e.stopPropagation();
                setExpanded(!expanded);
              }
            }}
          >
            {commentPreview}
          </p>
        </div>
      )}

      {/* Action buttons - hidden when sealed */}
      {!sealed && !editing && (
        <div className="annotation-item__actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="annotation-item__btn annotation-item__btn--edit"
            onClick={() => setEditing(true)}
            title="Edit comment"
          >
            Edit
          </button>
          <button
            className="annotation-item__btn annotation-item__btn--delete"
            onClick={() => onDelete(annotation.id)}
            title="Delete annotation"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/** Truncate string with ellipsis */
function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}
