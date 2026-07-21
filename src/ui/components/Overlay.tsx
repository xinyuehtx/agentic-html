import { ReactNode } from 'react';
import { InkCanvas, type InkStrokeResult } from './InkCanvas';
import { AnchorMarker, type AnchorData } from './AnchorMarker';

/** Interaction mode for the overlay */
export type OverlayMode = 'browse' | 'annotate';

/** Props for Overlay component */
export interface OverlayProps {
  /** Current mode: browse (pointer-events: none) or annotate (intercepts events) */
  mode: OverlayMode;
  /** Child elements to render inside the overlay (annotation markers, etc.) */
  children?: ReactNode;
  /** Optional className for additional styling */
  className?: string;
  /** Whether ink drawing is active */
  inkActive?: boolean;
  /** Callback when ink stroke is completed */
  onStrokeComplete?: (result: InkStrokeResult) => void;
  /** Anchor markers to display */
  anchors?: AnchorData[];
  /** Currently selected anchor id */
  selectedAnchorId?: string | null;
  /** Callback when an anchor marker is clicked */
  onAnchorClick?: (id: string) => void;
  /** Reference to the iframe element for anchor interactions */
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

/**
 * Overlay - transparent layer positioned above the preview iframe.
 * In browse mode: pointer-events are disabled, iframe is interactive.
 * In annotate mode: intercepts mouse/touch events for annotation drawing.
 * Renders InkCanvas for drawing and AnchorMarkers for placed annotations.
 */
export function Overlay({
  mode,
  children,
  className,
  inkActive = false,
  onStrokeComplete,
  anchors = [],
  selectedAnchorId,
  onAnchorClick,
  iframeRef,
}: OverlayProps) {
  const modeClass = mode === 'annotate'
    ? 'overlay-container--annotate'
    : 'overlay-container--browse';

  return (
    <div className={`overlay-container ${modeClass} ${className ?? ''}`} data-overlay="true">
      {/* Ink drawing canvas */}
      {mode === 'annotate' && onStrokeComplete && (
        <InkCanvas
          active={inkActive}
          onStrokeComplete={onStrokeComplete}
        />
      )}

      {/* Anchor markers (always visible) */}
      {anchors.map((anchor) => (
        <AnchorMarker
          key={anchor.id}
          anchor={anchor}
          selected={anchor.id === selectedAnchorId}
          onClick={onAnchorClick}
          iframeRef={iframeRef}
        />
      ))}

      {children}
    </div>
  );
}
