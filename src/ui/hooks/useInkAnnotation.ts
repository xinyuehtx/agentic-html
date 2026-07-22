import { useCallback, useRef, useState } from 'react';
import type { InkStrokeResult } from '../components/InkCanvas';
import { performHitTest, type Bounds } from '../utils/hitTest';
import { generateSelector } from '../utils/selectorGenerator';
import { captureRegion } from '../utils/captureRegion';

/** Annotation flow states */
export type InkAnnotationState = 'idle' | 'capturing' | 'placing';

/** Complete annotation data produced by the ink annotation flow */
export interface InkAnnotation {
  anchor_element: { selector: string };
  screenshot: string;
  hit_elements: Array<{ selector: string }>;
  ink_region: Bounds;
  /** Overlay coordinates (center of the ink region) for the anchor marker. */
  anchor: { x: number; y: number };
}

/**
 * useInkAnnotation — runs the ink annotation pipeline on stroke completion:
 * hit-test → screenshot → anchor selection, then hands the result to `onComplete`.
 * State is intentionally not held here; the annotation store is the source of truth.
 */
export function useInkAnnotation(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  onComplete: (annotation: InkAnnotation) => void,
) {
  const [state, setState] = useState<InkAnnotationState>('idle');
  const processingRef = useRef(false);

  const handleStrokeComplete = useCallback(
    async (result: InkStrokeResult) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setState('capturing');

      const iframeDoc = iframeRef.current?.contentDocument;
      if (!iframeDoc) {
        setState('idle');
        processingRef.current = false;
        return;
      }

      const { bounds } = result;
      const inkBounds: Bounds = {
        x: bounds.x,
        y: bounds.y,
        width: Math.max(bounds.width, 20),
        height: Math.max(bounds.height, 20),
      };

      try {
        const hitResult = performHitTest(iframeDoc, inkBounds, 0.3);
        const hitElements: Array<{ selector: string }> = [];
        for (const el of hitResult.elements) {
          try {
            hitElements.push({ selector: generateSelector(el) });
          } catch {
            /* skip elements without a selector */
          }
        }

        let screenshot = '';
        try {
          screenshot = await captureRegion(iframeDoc, inkBounds);
        } catch {
          /* screenshot optional */
        }

        const anchorElement = hitResult.elements[0] || iframeDoc.body;
        const anchorSelector = generateSelector(anchorElement);

        setState('placing');
        onComplete({
          anchor_element: { selector: anchorSelector },
          screenshot,
          hit_elements: hitElements,
          ink_region: inkBounds,
          anchor: {
            x: inkBounds.x + inkBounds.width / 2,
            y: inkBounds.y + inkBounds.height / 2,
          },
        });
      } finally {
        setState('idle');
        processingRef.current = false;
      }
    },
    [iframeRef, onComplete],
  );

  return { state, handleStrokeComplete };
}
