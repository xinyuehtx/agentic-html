import { useRef, useCallback, useEffect } from 'react';
import type { Bounds } from '../utils/hitTest';

/** A single sampled point with coordinates */
export interface InkPoint {
  x: number;
  y: number;
  t: number; // timestamp
}

/** Result passed to the completion callback */
export interface InkStrokeResult {
  points: InkPoint[];
  bounds: Bounds;
}

export interface InkCanvasProps {
  /** Whether the canvas is active and receiving input */
  active: boolean;
  /** Callback when stroke is completed (mouseup) */
  onStrokeComplete: (result: InkStrokeResult) => void;
}

/** Minimum movement distance (px) to record a new point */
const MIN_MOVE_DISTANCE = 3;
/** Sampling interval in ms (60Hz) */
const SAMPLE_INTERVAL = 16;
/** Maximum number of sample points */
const MAX_POINTS = 2000;
/** Maximum stroke duration in ms */
const MAX_DURATION = 30000;

/**
 * InkCanvas — SVG overlay for capturing freehand ink strokes.
 * Renders a smooth path using quadratic Bézier curves.
 * The stroke is temporary — cleared after completion.
 */
export function InkCanvas({ active, onStrokeComplete }: InkCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDrawing = useRef(false);
  const points = useRef<InkPoint[]>([]);
  const lastSampleTime = useRef(0);
  const pathRef = useRef<SVGPathElement>(null);
  const startTime = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Calculate bounds from collected points */
  const calculateBounds = useCallback((pts: InkPoint[]): Bounds => {
    if (pts.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, []);

  /** Build a smooth SVG path using quadratic Bézier curves */
  const buildPath = useCallback((pts: InkPoint[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (pts.length === 2) {
      return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    }

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x} ${pts[i].y} ${midX} ${midY}`;
    }
    // Last segment
    const last = pts[pts.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }, []);

  /** Update the displayed SVG path */
  const updatePathDisplay = useCallback(() => {
    if (pathRef.current) {
      pathRef.current.setAttribute('d', buildPath(points.current));
    }
  }, [buildPath]);

  /** End the current stroke */
  const endStroke = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const pts = [...points.current];
    if (pts.length > 1) {
      const bounds = calculateBounds(pts);
      onStrokeComplete({ points: pts, bounds });
    }

    // Clear the path display
    points.current = [];
    if (pathRef.current) {
      pathRef.current.setAttribute('d', '');
    }
  }, [calculateBounds, onStrokeComplete]);

  /** Distance between two points */
  const distance = (x1: number, y1: number, x2: number, y2: number) =>
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  /** Record a point if it meets sampling criteria */
  const samplePoint = useCallback((x: number, y: number) => {
    const now = Date.now();

    // Check max limits
    if (points.current.length >= MAX_POINTS) {
      endStroke();
      return;
    }
    if (now - startTime.current > MAX_DURATION) {
      endStroke();
      return;
    }

    // Check sampling interval
    if (now - lastSampleTime.current < SAMPLE_INTERVAL) return;

    // Check minimum distance
    if (points.current.length > 0) {
      const last = points.current[points.current.length - 1];
      if (distance(last.x, last.y, x, y) < MIN_MOVE_DISTANCE) return;
    }

    lastSampleTime.current = now;
    points.current.push({ x, y, t: now });
    updatePathDisplay();
  }, [endStroke, updatePathDisplay]);

  /** Get coordinates from mouse/touch event relative to SVG */
  const getCoords = useCallback((e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
  }, []);

  /** Mouse/touch event handlers */
  const handlePointerDown = useCallback((e: MouseEvent | TouchEvent) => {
    if (!active) return;
    e.preventDefault();

    const coords = getCoords(e);
    if (!coords) return;

    isDrawing.current = true;
    startTime.current = Date.now();
    lastSampleTime.current = 0;
    points.current = [{ x: coords.x, y: coords.y, t: Date.now() }];
    updatePathDisplay();

    // Set max duration timeout
    timeoutRef.current = setTimeout(() => {
      endStroke();
    }, MAX_DURATION);
  }, [active, getCoords, updatePathDisplay, endStroke]);

  const handlePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();

    const coords = getCoords(e);
    if (!coords) return;
    samplePoint(coords.x, coords.y);
  }, [getCoords, samplePoint]);

  const handlePointerUp = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    endStroke();
  }, [endStroke]);

  // Attach event listeners to SVG
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !active) return;

    const down = (e: MouseEvent) => handlePointerDown(e);
    const move = (e: MouseEvent) => handlePointerMove(e);
    const up = (e: MouseEvent) => handlePointerUp(e);
    const touchStart = (e: TouchEvent) => handlePointerDown(e);
    const touchMove = (e: TouchEvent) => handlePointerMove(e);
    const touchEnd = (e: TouchEvent) => handlePointerUp(e);

    svg.addEventListener('mousedown', down);
    svg.addEventListener('mousemove', move);
    svg.addEventListener('mouseup', up);
    svg.addEventListener('mouseleave', up);
    svg.addEventListener('touchstart', touchStart, { passive: false });
    svg.addEventListener('touchmove', touchMove, { passive: false });
    svg.addEventListener('touchend', touchEnd, { passive: false });
    svg.addEventListener('touchcancel', touchEnd, { passive: false });

    return () => {
      svg.removeEventListener('mousedown', down);
      svg.removeEventListener('mousemove', move);
      svg.removeEventListener('mouseup', up);
      svg.removeEventListener('mouseleave', up);
      svg.removeEventListener('touchstart', touchStart);
      svg.removeEventListener('touchmove', touchMove);
      svg.removeEventListener('touchend', touchEnd);
      svg.removeEventListener('touchcancel', touchEnd);
    };
  }, [active, handlePointerDown, handlePointerMove, handlePointerUp]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!active) return null;

  return (
    <svg
      ref={svgRef}
      className="ink-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: 'crosshair',
        touchAction: 'none',
      }}
    >
      <path
        ref={pathRef}
        fill="none"
        stroke="#f43f5e"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}
