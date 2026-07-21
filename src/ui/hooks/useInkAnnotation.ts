import { useState, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import type { InkStrokeResult } from '../components/InkCanvas';
import type { AnchorData } from '../components/AnchorMarker';
import { performHitTest, type Bounds } from '../utils/hitTest';
import { generateSelector } from '../utils/selectorGenerator';

/** Annotation flow states */
export type InkAnnotationState = 'idle' | 'drawing' | 'capturing' | 'placing';

/** Complete annotation data produced by the ink annotation flow */
export interface InkAnnotation {
  id: string;
  anchor_element: { selector: string };
  screenshot: string; // base64 data URL
  hit_elements: Array<{ selector: string }>;
  ink_region: Bounds;
  comment: string;
}

/** Screenshot constraints */
const MAX_SCREENSHOT_WIDTH = 800;
const MAX_SCREENSHOT_HEIGHT = 600;
const JPEG_QUALITY = 0.8;
const MAX_SCREENSHOT_SIZE = 500 * 1024; // 500KB

/** Generate a unique ID */
function generateId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * useInkAnnotation — manages the full ink annotation flow:
 * idle → drawing → capturing → placing
 */
export function useInkAnnotation(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  const [state, setState] = useState<InkAnnotationState>('idle');
  const [annotations, setAnnotations] = useState<InkAnnotation[]>([]);
  const [anchors, setAnchors] = useState<AnchorData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const processingRef = useRef(false);

  /** Start the drawing phase */
  const startDrawing = useCallback(() => {
    if (state !== 'idle') return;
    setState('drawing');
  }, [state]);

  /** Cancel current annotation flow and return to idle */
  const cancel = useCallback(() => {
    setState('idle');
    processingRef.current = false;
  }, []);

  /**
   * Capture a screenshot of the specified region from the iframe.
   * Applies size and quality constraints.
   */
  const captureScreenshot = useCallback(async (
    iframeDoc: Document,
    bounds: Bounds,
  ): Promise<string> => {
    const body = iframeDoc.body;
    if (!body) throw new Error('No body element in iframe');

    // Use html2canvas to render the iframe body
    const canvas = await html2canvas(body, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      windowWidth: iframeDoc.documentElement.scrollWidth,
      windowHeight: iframeDoc.documentElement.scrollHeight,
      useCORS: true,
      logging: false,
    });

    // Scale down if necessary
    let resultCanvas = canvas;
    if (canvas.width > MAX_SCREENSHOT_WIDTH || canvas.height > MAX_SCREENSHOT_HEIGHT) {
      const scale = Math.min(
        MAX_SCREENSHOT_WIDTH / canvas.width,
        MAX_SCREENSHOT_HEIGHT / canvas.height,
      );
      const scaledWidth = Math.round(canvas.width * scale);
      const scaledHeight = Math.round(canvas.height * scale);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = scaledWidth;
      tempCanvas.height = scaledHeight;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);
        resultCanvas = tempCanvas;
      }
    }

    // Compress to JPEG, adaptive quality if too large
    let quality = JPEG_QUALITY;
    let dataUrl = resultCanvas.toDataURL('image/jpeg', quality);

    // Adaptive compression: reduce quality until under size limit
    while (dataUrl.length > MAX_SCREENSHOT_SIZE && quality > 0.3) {
      quality -= 0.1;
      dataUrl = resultCanvas.toDataURL('image/jpeg', quality);
    }

    return dataUrl;
  }, []);

  /**
   * Handle stroke completion from InkCanvas.
   * Triggers: capturing → hit-test → screenshot → placing.
   */
  const handleStrokeComplete = useCallback(async (result: InkStrokeResult) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setState('capturing');

    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) {
      setState('idle');
      processingRef.current = false;
      return;
    }

    const iframeDoc = iframe.contentDocument;
    const { bounds } = result;

    try {
      // Ensure bounds have minimum size
      const inkBounds: Bounds = {
        x: bounds.x,
        y: bounds.y,
        width: Math.max(bounds.width, 20),
        height: Math.max(bounds.height, 20),
      };

      // 1. Perform hit-test
      const hitResult = performHitTest(iframeDoc, inkBounds, 0.3);

      // 2. Generate selectors for hit elements
      const hitElements: Array<{ selector: string }> = [];
      for (const el of hitResult.elements) {
        try {
          const selector = generateSelector(el);
          hitElements.push({ selector });
        } catch {
          // Skip elements that can't generate a selector
        }
      }

      // 3. Capture screenshot
      let screenshot = '';
      try {
        screenshot = await captureScreenshot(iframeDoc, inkBounds);
      } catch {
        // Screenshot may fail, continue without it
      }

      // 4. Determine anchor element (deepest hit element)
      const anchorElement = hitResult.elements[0] || iframeDoc.body;
      const anchorSelector = generateSelector(anchorElement);

      // 5. Calculate anchor position (center of ink bounds)
      const anchorX = inkBounds.x + inkBounds.width / 2;
      const anchorY = inkBounds.y + inkBounds.height / 2;

      // 6. Create annotation
      const id = generateId();
      const annotation: InkAnnotation = {
        id,
        anchor_element: { selector: anchorSelector },
        screenshot,
        hit_elements: hitElements,
        ink_region: inkBounds,
        comment: '',
      };

      // 7. Create anchor marker data
      const anchorData: AnchorData = {
        id,
        x: anchorX,
        y: anchorY,
        selector: anchorSelector,
        screenshot,
        hitElementSelectors: hitElements.map((h) => h.selector),
      };

      setState('placing');

      // 8. Add to state
      setAnnotations((prev) => [...prev, annotation]);
      setAnchors((prev) => [...prev, anchorData]);
      setSelectedId(id);

      // Done
      setState('idle');
    } catch {
      setState('idle');
    } finally {
      processingRef.current = false;
    }
  }, [iframeRef, captureScreenshot]);

  /** Select an annotation by id */
  const selectAnnotation = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  /** Remove an annotation by id */
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
    setAnchors((prev) =>
      prev.map((a) => (a.id === id ? { ...a, comment } : a)),
    );
  }, []);

  return {
    state,
    annotations,
    anchors,
    selectedId,
    startDrawing,
    cancel,
    handleStrokeComplete,
    selectAnnotation,
    removeAnnotation,
    updateComment,
  };
}
