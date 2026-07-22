import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  createElement,
} from 'react';
import type { UIAnnotation } from './useAnnotations';
import { useAnnotationSelection, type UseAnnotationSelectionReturn } from './useAnnotationSelection';
import { isDemoMode } from '../demoData';

/** How an annotation was created. */
export type AnnotationSource = 'ink' | 'element';

/** A working annotation held client-side. */
export interface StoreAnnotation extends UIAnnotation {
  source: AnnotationSource;
  /** Overlay coordinates for the anchor marker (capture-time). */
  anchor?: { x: number; y: number };
}

/** Input accepted by `add` — the store fills id/timestamp/status/version_id. */
export interface AddAnnotationInput {
  anchor_element: { selector: string; textOffset?: { start: number; end: number } };
  comment?: string;
  screenshot?: string;
  hit_elements?: UIAnnotation['hit_elements'];
  source: AnnotationSource;
  anchor?: { x: number; y: number };
}

export type SendResult = { ok: boolean; message: string } | null;

export interface AnnotationStoreValue {
  annotations: StoreAnnotation[];
  versionId: string | null;
  sealed: boolean;
  loading: boolean;
  error: string | null;
  sending: boolean;
  sendResult: SendResult;
  selection: UseAnnotationSelectionReturn;
  hydrate: (versionId: string | null) => void;
  add: (input: AddAnnotationInput) => StoreAnnotation;
  update: (id: string, comment: string) => void;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  clear: () => void;
  sendToAgent: () => Promise<void>;
}

const AnnotationStoreContext = createContext<AnnotationStoreValue | null>(null);

function makeId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a store annotation from add-input plus the surrounding context.
 * Pure and side-effect free so it can be unit-tested; the store supplies id/timestamp.
 */
export function buildStoreAnnotation(
  input: AddAnnotationInput,
  versionId: string | null,
  id: string,
  timestamp: string,
): StoreAnnotation {
  return {
    id,
    anchor_element: input.anchor_element,
    comment: input.comment ?? '',
    status: 'pending',
    timestamp,
    version_id: versionId ?? '',
    screenshot: input.screenshot,
    hit_elements: input.hit_elements,
    source: input.source,
    anchor: input.anchor,
  };
}

/** Fire-and-forget backend call; ignored in demo mode and on failure. */
function bestEffort(demo: boolean, run: () => Promise<Response>): void {
  if (demo) return;
  run().catch(() => {
    /* offline / no backend — client store remains source of truth */
  });
}

export function AnnotationStoreProvider({ children }: { children: ReactNode }) {
  const demo = isDemoMode();
  const [annotations, setAnnotations] = useState<StoreAnnotation[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [sealed, setSealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult>(null);
  const selection = useAnnotationSelection();
  const hydratedFor = useRef<string | null>(null);

  const hydrate = useCallback(
    (vid: string | null) => {
      if (vid === hydratedFor.current) return;
      hydratedFor.current = vid;
      setVersionId(vid);
      setSealed(false);
      setSendResult(null);
      setError(null);
      selection.clearSelection();

      if (!vid || demo) {
        setAnnotations([]);
        return;
      }

      setLoading(true);
      fetch(`/api/annotations?version_id=${encodeURIComponent(vid)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((data: UIAnnotation[]) => {
          setAnnotations(data.map((a) => ({ source: 'element', ...a })));
        })
        .catch(() => setAnnotations([]))
        .finally(() => setLoading(false));
    },
    [demo, selection],
  );

  const add = useCallback(
    (input: AddAnnotationInput): StoreAnnotation => {
      const annotation = buildStoreAnnotation(input, versionId, makeId(), new Date().toISOString());
      setAnnotations((prev) => [...prev, annotation]);
      bestEffort(demo, () =>
        fetch('/api/annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version_id: versionId, ...input }),
        }),
      );
      return annotation;
    },
    [demo, versionId],
  );

  const update = useCallback(
    (id: string, comment: string) => {
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, comment } : a)));
      bestEffort(demo, () =>
        fetch(`/api/annotations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment }),
        }),
      );
    },
    [demo],
  );

  const remove = useCallback(
    (id: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      bestEffort(demo, () => fetch(`/api/annotations/${id}`, { method: 'DELETE' }));
    },
    [demo],
  );

  const removeMany = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      setAnnotations((prev) => prev.filter((a) => !idSet.has(a.id)));
      bestEffort(demo, () =>
        fetch('/api/annotations/batch', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        }),
      );
    },
    [demo],
  );

  const clear = useCallback(() => {
    setAnnotations([]);
    selection.clearSelection();
  }, [selection]);

  const sendToAgent = useCallback(async () => {
    if (sending || sealed) return;
    if (annotations.length === 0) {
      setSendResult({ ok: false, message: 'No annotations to send' });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      if (!demo) {
        const res = await fetch('/api/annotations/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version_id: versionId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      setSealed(true);
      setSendResult({ ok: true, message: `Sent ${annotations.length} item(s) to agent` });
    } catch (err) {
      setSendResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Failed to send',
      });
    } finally {
      setSending(false);
    }
  }, [annotations.length, demo, sealed, sending, versionId]);

  const value = useMemo<AnnotationStoreValue>(
    () => ({
      annotations,
      versionId,
      sealed,
      loading,
      error,
      sending,
      sendResult,
      selection,
      hydrate,
      add,
      update,
      remove,
      removeMany,
      clear,
      sendToAgent,
    }),
    [annotations, versionId, sealed, loading, error, sending, sendResult, selection,
      hydrate, add, update, remove, removeMany, clear, sendToAgent],
  );

  return createElement(AnnotationStoreContext.Provider, { value }, children);
}

export function useAnnotationStore(): AnnotationStoreValue {
  const ctx = useContext(AnnotationStoreContext);
  if (!ctx) {
    throw new Error('useAnnotationStore must be used within an AnnotationStoreProvider');
  }
  return ctx;
}
