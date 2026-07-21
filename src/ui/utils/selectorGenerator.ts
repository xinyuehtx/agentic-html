/**
 * CSS Selector Generator — generates a unique CSS selector for a DOM element.
 * Strategy: id > unique class > nth-child path from body.
 */

/**
 * Generate a unique CSS selector for the given element within its document.
 */
export function generateSelector(element: Element): string {
  // If element has an id, use it directly (most specific)
  if (element.id) {
    const selector = `#${CSS.escape(element.id)}`;
    if (isUnique(element, selector)) {
      return selector;
    }
  }

  // Try unique class combination
  const classSelector = tryClassSelector(element);
  if (classSelector) {
    return classSelector;
  }

  // Fallback: build nth-child path from element up to body
  return buildNthChildPath(element);
}

/**
 * Try to build a selector from the element's class list that uniquely identifies it.
 */
function tryClassSelector(element: Element): string | null {
  if (!element.classList || element.classList.length === 0) return null;

  const tagName = element.tagName.toLowerCase();
  const doc = element.ownerDocument;
  if (!doc) return null;

  // Try tag + single class
  for (let i = 0; i < element.classList.length; i++) {
    const cls = element.classList[i];
    const selector = `${tagName}.${CSS.escape(cls)}`;
    try {
      const matches = doc.querySelectorAll(selector);
      if (matches.length === 1 && matches[0] === element) {
        return selector;
      }
    } catch {
      continue;
    }
  }

  // Try tag + all classes
  if (element.classList.length > 1) {
    const allClasses = Array.from(element.classList)
      .map((cls) => `.${CSS.escape(cls)}`)
      .join('');
    const selector = `${tagName}${allClasses}`;
    try {
      const matches = doc.querySelectorAll(selector);
      if (matches.length === 1 && matches[0] === element) {
        return selector;
      }
    } catch {
      // fall through
    }
  }

  return null;
}

/**
 * Build a selector path using nth-child from body to element.
 */
function buildNthChildPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.tagName.toLowerCase() !== 'html') {
    const tag = current.tagName.toLowerCase();

    if (tag === 'body') {
      parts.unshift('body');
      break;
    }

    const parent = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(current) + 1; // nth-child is 1-based
    parts.unshift(`${tag}:nth-child(${index})`);
    current = parent;
  }

  return parts.join(' > ');
}

/**
 * Check if a selector uniquely identifies the given element in its document.
 */
function isUnique(element: Element, selector: string): boolean {
  const doc = element.ownerDocument;
  if (!doc) return false;
  try {
    const matches = doc.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
}
