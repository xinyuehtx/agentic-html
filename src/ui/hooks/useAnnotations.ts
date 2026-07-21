import { useState, useCallback } from 'react';

/** Annotation type mirroring core types for UI usage */
export interface UIAnnotation {
  id: string;
  anchor_element: { selector: string; textOffset?: { start: number; end: number } };
  comment: string;
  status: 'pending' | 'resolved';
  timestamp: string;
  version_id: string;
  screenshot?: string;
  hit_elements?: Array<{
    selector: string;
    tag: string;
    outerHtmlSummary: string;
    boundingRect: { x: number; y: number; width: number; height: number };
  }>;
}

/** Create annotation input */
export interface CreateAnnotationInput {
  anchor_element: { selector: string; textOffset?: { start: number; end: number } };
  comment: string;
  screenshot?: string;
  hit_elements?: UIAnnotation['hit_elements'];
}

/** State returned by useAnnotations */
export interface UseAnnotationsState {
  annotations: UIAnnotation[];
  loading: boolean;
  error: string | null;
  fetchAnnotations: (versionId: string) => Promise<void>;
  createAnnotation: (versionId: string, data: CreateAnnotationInput) => Promise<void>;
  updateAnnotation: (id: string, update: { comment: string }) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  submitAnnotations: (versionId: string) => Promise<void>;
}

/**
 * useAnnotations - manages annotation CRUD operations with optimistic updates.
 */
export function useAnnotations(): UseAnnotationsState {
  const [annotations, setAnnotations] = useState<UIAnnotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnotations = useCallback(async (versionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/annotations?version_id=${encodeURIComponent(versionId)}`);
      if (!res.ok) throw new Error(`Failed to fetch annotations: ${res.status}`);
      const data: UIAnnotation[] = await res.json();
      setAnnotations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createAnnotation = useCallback(async (versionId: string, data: CreateAnnotationInput) => {
    setError(null);
    // Optimistic: add placeholder
    const tempId = `temp-${Date.now()}`;
    const optimistic: UIAnnotation = {
      id: tempId,
      anchor_element: data.anchor_element,
      comment: data.comment,
      status: 'pending',
      timestamp: new Date().toISOString(),
      version_id: versionId,
      screenshot: data.screenshot,
      hit_elements: data.hit_elements,
    };
    setAnnotations((prev) => [...prev, optimistic]);

    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId, ...data }),
      });
      if (!res.ok) throw new Error(`Failed to create annotation: ${res.status}`);
      const created: UIAnnotation = await res.json();
      // Replace optimistic entry with server response
      setAnnotations((prev) => prev.map((a) => (a.id === tempId ? created : a)));
    } catch (err) {
      // Rollback optimistic
      setAnnotations((prev) => prev.filter((a) => a.id !== tempId));
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const updateAnnotation = useCallback(async (id: string, update: { comment: string }) => {
    setError(null);
    // Optimistic update
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, comment: update.comment } : a))
    );

    try {
      const res = await fetch(`/api/annotations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error(`Failed to update annotation: ${res.status}`);
      const updated: UIAnnotation = await res.json();
      setAnnotations((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      // Refetch to restore correct state
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const deleteAnnotation = useCallback(async (id: string) => {
    setError(null);
    // Optimistic remove
    const prev = annotations;
    setAnnotations((current) => current.filter((a) => a.id !== id));

    try {
      const res = await fetch(`/api/annotations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete annotation: ${res.status}`);
    } catch (err) {
      // Rollback
      setAnnotations(prev);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [annotations]);

  const submitAnnotations = useCallback(async (versionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/annotations/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId }),
      });
      if (!res.ok) throw new Error(`Failed to submit annotations: ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    annotations,
    loading,
    error,
    fetchAnnotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    submitAnnotations,
  };
}
