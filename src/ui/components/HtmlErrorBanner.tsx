import { useState, useCallback } from 'react';

interface HtmlErrorBannerProps {
  errors: HtmlError[];
  onFeedback: (errors: HtmlError[]) => void;
}

export interface HtmlError {
  line?: number;
  column?: number;
  message: string;
  type: string;
}

/**
 * HtmlErrorBanner - displays red banner when HTML parsing errors are detected.
 * Shows error summary and provides "Feedback to Agent" button.
 */
export function HtmlErrorBanner({ errors, onFeedback }: HtmlErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleFeedback = useCallback(() => {
    onFeedback(errors);
    setFeedbackSent(true);
  }, [errors, onFeedback]);

  if (dismissed || errors.length === 0) {
    return null;
  }

  const summary = errors.length === 1
    ? `${errors[0].type}: ${errors[0].message}${errors[0].line != null ? ` (line ${errors[0].line})` : ''}`
    : `${errors.length} HTML errors detected`;

  return (
    <div className="html-error-banner">
      <span className="html-error-banner__icon">⚠️</span>
      <span className="html-error-banner__message" title={summary}>
        {summary}
      </span>
      <button
        className="html-error-banner__feedback-btn"
        onClick={handleFeedback}
        disabled={feedbackSent}
      >
        {feedbackSent ? 'Sent' : 'Feedback to Agent'}
      </button>
      <button
        className="html-error-banner__close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss error banner"
      >
        ✕
      </button>
    </div>
  );
}
