import { ReactNode } from 'react';
import { InkCanvas, type InkStrokeResult } from './InkCanvas';
import { AnchorMarker, type AnchorData } from './AnchorMarker';

/** Interaction mode for the overlay (mirrors the app mode). */
export type OverlayMode = 'browse' | 'ink' | 'select';

/** Props for Overlay component */
export interface OverlayProps {
  /** Current mode. Only `ink` makes the overlay capture pointer events. */
  mode: OverlayMode;
  /** Child elements rendered above the overlay (highlight chip, composer, etc.) */
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
 *
 * Pointer events by mode:
 * - `ink`: overlay captures events so InkCanvas can draw.
 * - `select` / `browse`: overlay is click-through so hover/click reach the iframe
 *   (element-capture attaches listeners inside the iframe). Interactive children
 *   (anchor markers, the add-to-chat composer) re-enable pointer events themselves.
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
  const modeClass = mode === 'ink'
    ? 'overlay-container--ink'
    : mode === 'select'
      ? 'overlay-container--select'
      : 'overlay-container--browse';

  return (
    <div className={`overlay-container ${modeClass} ${className ?? ''}`} data-overlay="true">
      {/* Ink drawing canvas (only in ink mode) */}
      {mode === 'ink' && onStrokeComplete && (
        <InkCanvas active={inkActive} onStrokeComplete={onStrokeComplete} />
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
