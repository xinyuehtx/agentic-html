import { useEffect, RefObject } from 'react';
import { PreviewFrameHandle } from './PreviewFrame';
import { AnnotationItem } from './AnnotationItem';
import { SubmitButton } from './SubmitButton';
import { useAnnotations } from '../hooks/useAnnotations';
import { useAnnotationSelection } from '../hooks/useAnnotationSelection';
import { useScrollToElement } from '../hooks/useScrollToElement';

export interface AnnotationSidebarProps {
  /** Current version ID */
  versionId: string | null;
  /** Whether the current version is sealed */
  sealed: boolean;
  /** Ref to the PreviewFrame for scroll/highlight */
  previewRef: RefObject<PreviewFrameHandle | null>;
}

/**
 * AnnotationSidebar - right panel showing all annotations for the current version.
 * Provides CRUD operations, scroll-to-element, and submit functionality.
 */
export function AnnotationSidebar({ versionId, sealed, previewRef }: AnnotationSidebarProps) {
  const {
    annotations,
    loading,
    error,
    fetchAnnotations,
    updateAnnotation,
    deleteAnnotation,
    submitAnnotations,
    batchDelete,
    batchSubmit,
  } = useAnnotations();

  const {
    selectedIds,
    isSelected,
    toggle,
    selectAll,
    clearSelection,
    selectedCount,
  } = useAnnotationSelection();

  const { scrollToElement } = useScrollToElement(previewRef);

  // Fetch annotations when versionId changes
  useEffect(() => {
    if (versionId) {
      fetchAnnotations(versionId);
    }
  }, [versionId, fetchAnnotations]);

  const handleItemClick = (selector: string) => {
    scrollToElement(selector);
  };

  const handleUpdate = (id: string, comment: string) => {
    updateAnnotation(id, { comment });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this annotation?')) {
      deleteAnnotation(id);
    }
  };

  const handleSubmit = async () => {
    if (versionId) {
      await submitAnnotations(versionId);
      // Refetch to get updated state
      await fetchAnnotations(versionId);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedCount === 0) return;
    if (window.confirm(`Delete ${selectedCount} selected annotation(s)?`)) {
      await batchDelete(Array.from(selectedIds));
      clearSelection();
    }
  };

  const handleBatchSubmit = async () => {
    if (versionId && selectedCount > 0) {
      await batchSubmit(versionId, Array.from(selectedIds));
      clearSelection();
    }
  };

  const handleSelectAll = () => {
    selectAll(annotations.map((a) => a.id));
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
              onChange={(e) => {
                if (e.target.checked) {
                  handleSelectAll();
                } else {
                  clearSelection();
                }
              }}
            />
            Select All
          </label>
        )}
        {versionId && (
          <span className="annotation-sidebar__version" title={versionId}>
            {versionId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="annotation-sidebar__error">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="annotation-sidebar__loading">Loading annotations...</div>
      )}

      {/* Annotation list */}
      <div className="annotation-sidebar__list">
        {!loading && annotations.length === 0 && (
          <div className="annotation-sidebar__empty">
            <p>No annotations yet.</p>
            <p className="annotation-sidebar__empty-hint">
              Use the annotation tool to mark elements on the page.
            </p>
          </div>
        )}

        {annotations.map((annotation, idx) => (
          <AnnotationItem
            key={annotation.id}
            annotation={annotation}
            index={idx + 1}
            sealed={sealed}
            isSelected={isSelected(annotation.id)}
            onToggle={toggle}
            onClick={handleItemClick}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Footer: count + submit + batch actions */}
      <div className="annotation-sidebar__footer">
        <div className="annotation-sidebar__meta">
          <span className="annotation-sidebar__count">
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          </span>
          <span className={`annotation-sidebar__seal-status ${sealed ? 'annotation-sidebar__seal-status--sealed' : ''}`}>
            {sealed ? 'Sealed' : 'Unsealed'}
          </span>
        </div>
        {selectedCount > 0 && !sealed && (
          <div className="annotation-sidebar__batch-actions">
            <button
              className="annotation-sidebar__batch-btn annotation-sidebar__batch-btn--delete"
              onClick={handleBatchDelete}
            >
              Delete Selected ({selectedCount})
            </button>
            <button
              className="annotation-sidebar__batch-btn annotation-sidebar__batch-btn--submit"
              onClick={handleBatchSubmit}
            >
              Submit Selected ({selectedCount})
            </button>
          </div>
        )}
        {versionId && (
          <SubmitButton sealed={sealed} onSubmit={handleSubmit} />
        )}
      </div>
    </div>
  );
}
