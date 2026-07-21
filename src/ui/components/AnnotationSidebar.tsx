import { useEffect, RefObject } from 'react';
import { PreviewFrameHandle } from './PreviewFrame';
import { AnnotationItem } from './AnnotationItem';
import { SubmitButton } from './SubmitButton';
import { useAnnotations } from '../hooks/useAnnotations';
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
  } = useAnnotations();

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

  return (
    <div className="annotation-sidebar">
      {/* Header */}
      <div className="annotation-sidebar__header">
        <h3 className="annotation-sidebar__title">Annotations</h3>
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
            onClick={handleItemClick}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Footer: count + submit */}
      <div className="annotation-sidebar__footer">
        <div className="annotation-sidebar__meta">
          <span className="annotation-sidebar__count">
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          </span>
          <span className={`annotation-sidebar__seal-status ${sealed ? 'annotation-sidebar__seal-status--sealed' : ''}`}>
            {sealed ? 'Sealed' : 'Unsealed'}
          </span>
        </div>
        {versionId && (
          <SubmitButton sealed={sealed} onSubmit={handleSubmit} />
        )}
      </div>
    </div>
  );
}
