import { useCallback, RefObject } from 'react';
import { PreviewFrameHandle } from '../components/PreviewFrame';

/** Highlight style injected into iframe */
const HIGHLIGHT_CLASS = '__agentic-highlight__';
const HIGHLIGHT_STYLE_ID = '__agentic-highlight-style__';

const HIGHLIGHT_CSS = `
.${HIGHLIGHT_CLASS} {
  outline: 3px solid #3b82f6 !important;
  outline-offset: 2px !important;
  animation: __agentic-blink__ 0.5s ease-in-out 4;
}
@keyframes __agentic-blink__ {
  0%, 100% { outline-color: #3b82f6; }
  50% { outline-color: transparent; }
}
`;

/**
 * useScrollToElement - scroll iframe to a CSS selector and highlight it.
 * Supports SPA route detection: if element is not found, attempts navigation.
 */
export function useScrollToElement(previewRef: RefObject<PreviewFrameHandle | null>) {
  const ensureHighlightStyle = useCallback((doc: Document) => {
    if (!doc.getElementById(HIGHLIGHT_STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = HIGHLIGHT_STYLE_ID;
      style.textContent = HIGHLIGHT_CSS;
      doc.head.appendChild(style);
    }
  }, []);

  const scrollToElement = useCallback(
    (selector: string) => {
      const iframe = previewRef.current?.getIframe();
      if (!iframe) return;

      const doc = iframe.contentDocument;
      if (!doc) return;

      ensureHighlightStyle(doc);

      let el = doc.querySelector(selector);

      // SPA route handling: if element not found and selector contains route info
      if (!el && iframe.contentWindow) {
        // Try to extract route from selector (e.g., [data-route="/about"] .title)
        const routeMatch = selector.match(/\[data-route=["']([^"']+)["']\]/);
        if (routeMatch) {
          const route = routeMatch[1];
          try {
            iframe.contentWindow.location.hash = route;
          } catch {
            // cross-origin or other issues - silently fail
          }
          // Retry after a short delay for SPA navigation
          setTimeout(() => {
            const retryEl = doc.querySelector(selector);
            if (retryEl) {
              highlightElement(retryEl as HTMLElement, doc);
            }
          }, 500);
          return;
        }
      }

      if (el) {
        highlightElement(el as HTMLElement, doc);
      }
    },
    [previewRef, ensureHighlightStyle]
  );

  const highlightElement = useCallback((el: HTMLElement, doc: Document) => {
    // Remove previous highlights
    const prevHighlighted = doc.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    prevHighlighted.forEach((prev) => prev.classList.remove(HIGHLIGHT_CLASS));

    // Scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add highlight
    el.classList.add(HIGHLIGHT_CLASS);

    // Remove highlight after 2 seconds
    setTimeout(() => {
      el.classList.remove(HIGHLIGHT_CLASS);
    }, 2000);
  }, []);

  return { scrollToElement };
}
