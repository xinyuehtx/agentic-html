/**
 * Hit-test algorithm utility functions.
 * Performs grid-based sampling within a bounding region to identify DOM elements
 * that intersect with an ink annotation region.
 */

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface HitTestResult {
  elements: Element[];
  timedOut: boolean;
}

/** Tags to exclude from hit-test results */
const EXCLUDED_TAGS = new Set([
  'html', 'head', 'script', 'style', 'link', 'meta', 'title', 'noscript',
]);

/**
 * Generate grid sampling points within the given bounds.
 * @param bounds - The bounding rectangle
 * @param step - Spacing between sample points (default: 10px)
 */
export function generateGridPoints(bounds: Bounds, step = 10): Point[] {
  const points: Point[] = [];
  const endX = bounds.x + bounds.width;
  const endY = bounds.y + bounds.height;

  for (let y = bounds.y; y <= endY; y += step) {
    for (let x = bounds.x; x <= endX; x += step) {
      points.push({ x, y });
    }
  }

  return points;
}

/**
 * Calculate the intersection area ratio between an element's bounding rect
 * and the ink bounds region.
 * Returns the ratio of intersection area to the element's area.
 */
export function calculateIntersectionRatio(elementRect: DOMRect, bounds: Bounds): number {
  const boundsRight = bounds.x + bounds.width;
  const boundsBottom = bounds.y + bounds.height;

  const intersectLeft = Math.max(elementRect.left, bounds.x);
  const intersectTop = Math.max(elementRect.top, bounds.y);
  const intersectRight = Math.min(elementRect.right, boundsRight);
  const intersectBottom = Math.min(elementRect.bottom, boundsBottom);

  const intersectWidth = Math.max(0, intersectRight - intersectLeft);
  const intersectHeight = Math.max(0, intersectBottom - intersectTop);
  const intersectArea = intersectWidth * intersectHeight;

  const elementArea = elementRect.width * elementRect.height;
  if (elementArea === 0) return 0;

  return intersectArea / elementArea;
}

/**
 * Get the DOM depth of an element (distance from document root).
 */
export function getElementDepth(element: Element): number {
  let depth = 0;
  let current: Element | null = element;
  while (current) {
    depth++;
    current = current.parentElement;
  }
  return depth;
}

/**
 * Check if an element is visible (has dimensions and is not hidden).
 */
function isElementVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return false;
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;

  return true;
}

/**
 * Check if an element should be excluded from hit-test results.
 */
function shouldExclude(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (EXCLUDED_TAGS.has(tag)) return true;

  // Exclude overlay elements (data attribute convention)
  if (element.closest('[data-overlay]')) return true;

  return false;
}

/**
 * Perform a complete hit-test on the iframe document within the given bounds.
 * Uses grid sampling with elementsFromPoint to find intersecting elements.
 *
 * @param iframeDoc - The iframe's document object
 * @param bounds - The ink region bounds (in iframe viewport coordinates)
 * @param threshold - Minimum intersection ratio (default: 0.3)
 * @param timeoutMs - Maximum execution time in ms (default: 2000)
 */
export function performHitTest(
  iframeDoc: Document,
  bounds: Bounds,
  threshold = 0.3,
  timeoutMs = 2000,
): HitTestResult {
  const startTime = Date.now();
  const collectedElements = new Set<Element>();
  let timedOut = false;

  // Generate grid sample points
  const points = generateGridPoints(bounds, 10);

  // Sample each point
  for (const point of points) {
    // Timeout check
    if (Date.now() - startTime > timeoutMs) {
      timedOut = true;
      break;
    }

    try {
      const elements = iframeDoc.elementsFromPoint(point.x, point.y);
      for (const el of elements) {
        if (!shouldExclude(el)) {
          collectedElements.add(el);
        }
      }
    } catch {
      // elementsFromPoint may fail for some points (out of viewport)
      continue;
    }
  }

  // Filter by visibility and intersection ratio
  const filteredElements: Array<{ element: Element; depth: number }> = [];

  for (const element of collectedElements) {
    // Timeout check during filtering
    if (Date.now() - startTime > timeoutMs) {
      timedOut = true;
      break;
    }

    if (!isElementVisible(element)) continue;

    const rect = element.getBoundingClientRect();
    const ratio = calculateIntersectionRatio(rect, bounds);

    if (ratio >= threshold) {
      filteredElements.push({
        element,
        depth: getElementDepth(element),
      });
    }
  }

  // Sort by DOM depth descending (deepest first)
  filteredElements.sort((a, b) => b.depth - a.depth);

  const resultElements = filteredElements.map((item) => item.element);

  // Fallback: if no results, return body
  if (resultElements.length === 0) {
    const body = iframeDoc.body;
    if (body) {
      return { elements: [body], timedOut };
    }
  }

  return { elements: resultElements, timedOut };
}
