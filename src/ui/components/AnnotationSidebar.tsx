import { RefObject } from 'react';
import { PreviewFrameHandle } from './PreviewFrame';
import { AnnotationItem } from './AnnotationItem';
import { SubmitButton } from './SubmitButton';
import { useAnnotationStore } from '../hooks/useAnnotationStore';
import { useScrollToElement } from '../hooks/useScrollToElement';

export interface AnnotationSidebarProps {
  /** Ref to the PreviewFrame for scroll/highlight */
  previewRef: RefObject<PreviewFrameHandle | null>;
}

/**
 * AnnotationSidebar - right panel showing all annotations for the current version.
 * Reads from the shared annotation store; provides CRUD, batch ops, scroll-to-element,
 * and submit.
 */
export function AnnotationSidebar({ previewRef }: AnnotationSidebarProps) {
  const {
    annotations,
    versionId,
    sealed,
    loading,
    error,
    sendResult,
    selection,
    update,
    remove,
    removeMany,
    sendToAgent,
  } = useAnnotationStore();

  const { selectedIds, isSelected, toggle, selectAll, clearSelection, selectedCount } = selection;
  const { scrollToElement } = useScrollToElement(previewRef);

  const handleBatchDelete = () => {
    if (selectedCount === 0) return;
    if (window.confirm(`Delete ${selectedCount} selected annotation(s)?`)) {
      removeMany(Array.from(selectedIds));
      clearSelection();
    }
  };

  return (
    <div className="annotation-sidebar">
      {/* Header */}
      <div className="annotation-sidebar__header">
        <h3 className="annotation-sidebar__title">Annotations</h3>
        {annotations.length > 0 && !sealed && (
          <label className="annotation-sidebar__select-all">
            <input
              type="checkbox"
              checked={selectedCount === annotations.length && annotations.length > 0}
              onChange={(e) =>
                e.target.checked ? selectAll(annotations.map((a) => a.id)) : clearSelection()
              }
            />
            All
          </label>
        )}
        {versionId && (
          <span className="annotation-sidebar__version" title={versionId}>
            #{versionId.slice(0, 8)}
          </span>
        )}
      </div>

      {error && <div className="annotation-sidebar__error">{error}</div>}
      {loading && <div className="annotation-sidebar__loading">Loading annotations…</div>}

      {/* Annotation list */}
      <div className="annotation-sidebar__list">
        {!loading && annotations.length === 0 && (
          <div className="annotation-sidebar__empty">
            <div className="annotation-sidebar__empty-mark" aria-hidden>⊹</div>
            <p>No annotations yet.</p>
            <p className="annotation-sidebar__empty-hint">
              Use <b>Ink</b> to circle a region or <b>Select</b> to add an element to chat.
            </p>
          </div>
        )}

        {annotations.map((annotation, idx) => (
          <AnnotationItem
            key={annotation.id}
            annotation={annotation}
            source={annotation.source}
            index={idx + 1}
            sealed={sealed}
            isSelected={isSelected(annotation.id)}
            onToggle={toggle}
            onClick={scrollToElement}
            onUpdate={(id, comment) => update(id, comment)}
            onDelete={(id) => {
              if (window.confirm('Delete this annotation?')) remove(id);
            }}
          />
        ))}
      </div>

      {/* Footer: count + submit + batch actions */}
      <div className="annotation-sidebar__footer">
        <div className="annotation-sidebar__meta">
          <span className="annotation-sidebar__count">
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          </span>
          <span
            className={`annotation-sidebar__seal-status ${
              sealed ? 'annotation-sidebar__seal-status--sealed' : ''
            }`}
          >
            {sealed ? 'Sealed' : 'Unsealed'}
          </span>
        </div>

        {sendResult && (
          <div
            className={`annotation-sidebar__send-result annotation-sidebar__send-result--${
              sendResult.ok ? 'ok' : 'err'
            }`}
          >
            {sendResult.message}
          </div>
        )}

        {selectedCount > 0 && !sealed && (
          <div className="annotation-sidebar__batch-actions">
            <button
              className="annotation-sidebar__batch-btn annotation-sidebar__batch-btn--delete"
              onClick={handleBatchDelete}
            >
              Delete ({selectedCount})
            </button>
          </div>
        )}

        {versionId && <SubmitButton sealed={sealed} onSubmit={sendToAgent} />}
      </div>
    </div>
  );
}
