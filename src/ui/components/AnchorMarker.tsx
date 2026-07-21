import { useState, useCallback, useRef, useEffect } from 'react';

/** Anchor information for rendering markers */
export interface AnchorData {
  id: string;
  /** Position relative to the overlay container */
  x: number;
  y: number;
  /** CSS selector of the anchor element in the iframe */
  selector: string;
  /** Base64 screenshot thumbnail */
  screenshot?: string;
  /** Selectors of hit elements to highlight on hover */
  hitElementSelectors?: string[];
  /** Optional comment text */
  comment?: string;
}

export interface AnchorMarkerProps {
  anchor: AnchorData;
  /** Whether this marker is currently selected */
  selected?: boolean;
  /** Callback when marker is clicked */
  onClick?: (id: string) => void;
  /** Reference to the iframe element for highlight interaction */
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

/**
 * AnchorMarker — renders a small circular marker at the anchor position.
 * On hover: shows screenshot tooltip and highlights hit elements in iframe.
 * On click: selects the annotation.
 */
export function AnchorMarker({ anchor, selected, onClick, iframeRef }: AnchorMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  /** Highlight hit elements in the iframe */
  const highlightElements = useCallback((show: boolean) => {
    if (!iframeRef?.current?.contentDocument) return;
    if (!anchor.hitElementSelectors?.length) return;

    const doc = iframeRef.current.contentDocument;

    for (const selector of anchor.hitElementSelectors) {
      try {
        const el = doc.querySelector(selector) as HTMLElement | null;
        if (el) {
          if (show) {
            el.style.outline = '2px solid #f43f5e';
            el.style.outlineOffset = '2px';
            el.dataset.annotationHighlight = 'true';
          } else {
            el.style.outline = '';
            el.style.outlineOffset = '';
            delete el.dataset.annotationHighlight;
          }
        }
      } catch {
        // Invalid selector, skip
      }
    }
  }, [iframeRef, anchor.hitElementSelectors]);

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    highlightElements(true);
  }, [highlightElements]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    highlightElements(false);
  }, [highlightElements]);

  const handleClick = useCallback(() => {
    onClick?.(anchor.id);
  }, [onClick, anchor.id]);

  // Clean up highlights on unmount
  useEffect(() => {
    return () => {
      highlightElements(false);
    };
  }, [highlightElements]);

  return (
    <div
      className="anchor-marker"
      style={{
        position: 'absolute',
        left: anchor.x - 8,
        top: anchor.y - 8,
        zIndex: selected ? 100 : 10,
        pointerEvents: 'auto',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Marker dot */}
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: selected ? '#e11d48' : '#f43f5e',
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          transition: 'transform 0.15s ease',
          transform: hovered ? 'scale(1.3)' : 'scale(1)',
        }}
      />

      {/* Screenshot tooltip on hover */}
      {hovered && anchor.screenshot && (
        <div
          ref={tooltipRef}
          className="anchor-marker__tooltip"
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxWidth: 320,
            maxHeight: 240,
            overflow: 'hidden',
          }}
        >
          <img
            src={anchor.screenshot}
            alt="Annotation screenshot"
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 220,
              objectFit: 'contain',
              borderRadius: 4,
            }}
          />
          {anchor.comment && (
            <div
              style={{
                marginTop: 4,
                padding: '2px 4px',
                fontSize: 11,
                color: '#475569',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {anchor.comment}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
