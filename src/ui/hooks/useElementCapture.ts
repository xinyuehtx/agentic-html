import { useCallback, useEffect, useRef, useState } from 'react';
import { generateSelector } from '../utils/selectorGenerator';
import { captureRegion } from '../utils/captureRegion';
import type { Bounds } from '../utils/hitTest';

/** Data captured when the user clicks an element in select mode. */
export interface ElementCapture {
  selector: string;
  tag: string;
  outerHtmlSummary: string;
  rect: Bounds;
  screenshot?: string;
  /** Overlay coordinates for positioning the composer / marker. */
  anchorX: number;
  anchorY: number;
}

/** Currently hovered element info (for the floating label chip). */
export interface HoveredElement {
  rect: Bounds;
  label: string;
}

const OUTLINE = '2px solid var(--ah-capture-outline, #22d3ee)';
const MAX_OUTER_HTML = 200;

/**
 * useElementCapture — VSCode-inline-browser-style "add element to chat".
 * When active, hovering an element in the iframe highlights it, and clicking it
 * captures {selector, tag, outerHTML, rect, screenshot} into a pending state that
 * the caller turns into an annotation via a compose step.
 */
export function useElementCapture(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  active: boolean,
) {
  const [hovered, setHovered] = useState<HoveredElement | null>(null);
  const [pending, setPending] = useState<ElementCapture | null>(null);
  const hoveredElRef = useRef<HTMLElement | null>(null);
  const processingRef = useRef(false);

  const clearOutline = useCallback(() => {
    const el = hoveredElRef.current;
    if (el) {
      el.style.outline = '';
      el.style.outlineOffset = '';
      delete el.dataset.ahCaptureHover;
      hoveredElRef.current = null;
    }
  }, []);

  const clearPending = useCallback(() => setPending(null), []);

  const handleMouseOver = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    if (!target || target === hoveredElRef.current) return;
    const tag = target.tagName?.toLowerCase();
    if (!tag || tag === 'html') return;

    clearOutline();
    target.style.outline = OUTLINE;
    target.style.outlineOffset = '1px';
    target.dataset.ahCaptureHover = 'true';
    hoveredElRef.current = target;

    const rect = target.getBoundingClientRect();
    let label = tag;
    if (target.id) label += `#${target.id}`;
    else if (target.classList.length) label += `.${target.classList[0]}`;
    setHovered({ rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }, label });
  }, [clearOutline]);

  const handleMouseOut = useCallback(() => {
    clearOutline();
    setHovered(null);
  }, [clearOutline]);

  const handleClick = useCallback(async (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target || target.tagName?.toLowerCase() === 'html') return;
    e.preventDefault();
    e.stopPropagation();
    if (processingRef.current) return;
    processingRef.current = true;

    const rect = target.getBoundingClientRect();
    const bounds: Bounds = {
      x: rect.left,
      y: rect.top,
      width: Math.max(rect.width, 8),
      height: Math.max(rect.height, 8),
    };
    const selector = generateSelector(target);
    const capture: ElementCapture = {
      selector,
      tag: target.tagName.toLowerCase(),
      outerHtmlSummary: target.outerHTML.slice(0, MAX_OUTER_HTML),
      rect: bounds,
      anchorX: rect.left + rect.width / 2,
      anchorY: rect.top + rect.height / 2,
    };

    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      try {
        capture.screenshot = await captureRegion(doc, bounds);
      } catch {
        // screenshot optional
      }
    }

    clearOutline();
    setHovered(null);
    setPending(capture);
    processingRef.current = false;
  }, [iframeRef, clearOutline]);

  useEffect(() => {
    if (!active) {
      clearOutline();
      setHovered(null);
      return;
    }
    const iframe = iframeRef.current;
    if (!iframe) return;

    const attach = () => {
      const doc = iframe.contentDocument;
      if (!doc) return () => {};
      doc.addEventListener('mouseover', handleMouseOver, true);
      doc.addEventListener('mouseout', handleMouseOut, true);
      doc.addEventListener('click', handleClick, true);
      return () => {
        doc.removeEventListener('mouseover', handleMouseOver, true);
        doc.removeEventListener('mouseout', handleMouseOut, true);
        doc.removeEventListener('click', handleClick, true);
      };
    };

    let detach = attach();
    const onLoad = () => {
      detach();
      detach = attach();
    };
    iframe.addEventListener('load', onLoad);

    return () => {
      detach();
      iframe.removeEventListener('load', onLoad);
      clearOutline();
    };
  }, [active, iframeRef, handleMouseOver, handleMouseOut, handleClick, clearOutline]);

  return { hovered, pending, clearPending };
}
