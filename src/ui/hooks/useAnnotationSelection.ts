import { useState, useCallback, useRef } from 'react';

export interface UseAnnotationSelectionReturn {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleRange: (id: string, allIds: string[]) => void;
  selectAll: (allIds: string[]) => void;
  clearSelection: () => void;
  selectedCount: number;
}

/**
 * useAnnotationSelection - manages multi-selection state for annotations.
 * Supports single toggle, shift+click range selection, select all, and clear.
 */
export function useAnnotationSelection(): UseAnnotationSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIdRef = useRef<string | null>(null);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastClickedIdRef.current = id;
  }, []);

  const toggleRange = useCallback((id: string, allIds: string[]) => {
    const lastId = lastClickedIdRef.current;
    if (!lastId) {
      // No previous click, just toggle
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      lastClickedIdRef.current = id;
      return;
    }

    const startIndex = allIds.indexOf(lastId);
    const endIndex = allIds.indexOf(id);

    if (startIndex === -1 || endIndex === -1) {
      // Fallback: just toggle
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      lastClickedIdRef.current = id;
      return;
    }

    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    const rangeIds = allIds.slice(from, to + 1);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const rangeId of rangeIds) {
        next.add(rangeId);
      }
      return next;
    });
    lastClickedIdRef.current = id;
  }, []);

  const selectAll = useCallback((allIds: string[]) => {
    setSelectedIds(new Set(allIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedIdRef.current = null;
  }, []);

  return {
    selectedIds,
    isSelected,
    toggle,
    toggleRange,
    selectAll,
    clearSelection,
    selectedCount: selectedIds.size,
  };
}
