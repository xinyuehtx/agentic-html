import { useState, useCallback, useEffect } from 'react';
import { generateSelector } from '../utils/selectorGenerator';
import type { AnchorData } from '../components/AnchorMarker';

/** Click annotation data */
export interface ClickAnnotation {
  id: string;
  anchor_element: { selector: string };
  comment: string;
}

/** Generate a unique ID */
function generateId(): string {
  return `click_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * useClickAnnotation — hook for click-based annotation.
 * When active, clicking an element in the iframe creates an annotation
 * anchored to that element.
 */
export function useClickAnnotation(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  const [active, setActive] = useState(false);
  const [annotations, setAnnotations] = useState<ClickAnnotation[]>([]);
  const [anchors, setAnchors] = useState<AnchorData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** Enable click annotation mode */
  const enable = useCallback(() => setActive(true), []);

  /** Disable click annotation mode */
  const disable = useCallback(() => setActive(false), []);

  /** Toggle click annotation mode */
  const toggle = useCallback(() => setActive((prev) => !prev), []);

  /** Handle click on iframe content */
  const handleIframeClick = useCallback((e: MouseEvent) => {
    if (!active) return;

    const target = e.target as Element;
    if (!target || target.tagName.toLowerCase() === 'html') return;

    e.preventDefault();
    e.stopPropagation();

    // Generate selector for the clicked element
    const selector = generateSelector(target);
    const id = generateId();

    // Get element position for the anchor marker
    const rect = target.getBoundingClientRect();
    const anchorX = rect.left + rect.width / 2;
    const anchorY = rect.top + rect.height / 2;

    // Create annotation
    const annotation: ClickAnnotation = {
      id,
      anchor_element: { selector },
      comment: '',
    };

    // Create anchor data
    const anchorData: AnchorData = {
      id,
      x: anchorX,
      y: anchorY,
      selector,
    };

    setAnnotations((prev) => [...prev, annotation]);
    setAnchors((prev) => [...prev, anchorData]);
    setSelectedId(id);
  }, [active]);

  // Attach click listener to iframe document
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !active) return;

    const attachListener = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      doc.addEventListener('click', handleIframeClick, true);
      return () => {
        doc.removeEventListener('click', handleIframeClick, true);
      };
    };

    // Try to attach immediately
    let cleanup = attachListener();

    // Also attach on iframe load (for when content changes)
    const onLoad = () => {
      cleanup?.();
      cleanup = attachListener();
    };
    iframe.addEventListener('load', onLoad);

    return () => {
      cleanup?.();
      iframe.removeEventListener('load', onLoad);
    };
  }, [iframeRef, active, handleIframeClick]);

  /** Select an annotation */
  const selectAnnotation = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  /** Remove an annotation */
  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setAnchors((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  }, [selectedId]);

  /** Update annotation comment */
  const updateComment = useCallback((id: string, comment: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, comment } : a)),
    );
  }, []);

  return {
    active,
    annotations,
    anchors,
    selectedId,
    enable,
    disable,
    toggle,
    selectAnnotation,
    removeAnnotation,
    updateComment,
  };
}
