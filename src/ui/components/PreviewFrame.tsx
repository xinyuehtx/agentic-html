import { forwardRef, useImperativeHandle, useRef, type RefObject } from 'react';

/** Props for PreviewFrame component */
export interface PreviewFrameProps {
  /** HTML content to render in the iframe via srcdoc */
  htmlContent: string | null;
  /** Optional className for styling */
  className?: string;
  /**
   * Optional ref that receives the underlying <iframe> element. Annotation hooks
   * (ink, element capture, anchor highlight) need a RefObject to the raw element,
   * which the imperative handle does not provide.
   */
  elementRef?: RefObject<HTMLIFrameElement | null>;
}

/** Ref handle exposed by PreviewFrame */
export interface PreviewFrameHandle {
  /** Get the iframe element */
  getIframe: () => HTMLIFrameElement | null;
  /** Scroll to a specific position within the iframe */
  scrollTo: (x: number, y: number) => void;
  /** Scroll an element into view by selector */
  scrollToSelector: (selector: string) => void;
}

/**
 * PreviewFrame - sandboxed iframe component for rendering HTML preview.
 * Uses srcdoc for content injection with sandbox restrictions.
 */
export const PreviewFrame = forwardRef<PreviewFrameHandle, PreviewFrameProps>(
  function PreviewFrame({ htmlContent, className, elementRef }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    /** Assign the internal ref and mirror the element to the optional elementRef. */
    const setIframe = (el: HTMLIFrameElement | null) => {
      iframeRef.current = el;
      if (elementRef) elementRef.current = el;
    };

    useImperativeHandle(ref, () => ({
      getIframe() {
        return iframeRef.current;
      },
      scrollTo(x: number, y: number) {
        const iframe = iframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.scrollTo(x, y);
        }
      },
      scrollToSelector(selector: string) {
        const iframe = iframeRef.current;
        if (iframe?.contentDocument) {
          const el = iframe.contentDocument.querySelector(selector);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      },
    }));

    return (
      <iframe
        ref={setIframe}
        className={`preview-iframe ${className ?? ''}`}
        sandbox="allow-scripts allow-same-origin"
        srcDoc={htmlContent ?? ''}
        title="HTML Preview"
      />
    );
  }
);
