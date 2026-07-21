import { useState } from 'react';

export interface SubmitButtonProps {
  /** Whether the version is sealed */
  sealed: boolean;
  /** Submit handler */
  onSubmit: () => Promise<void>;
}

/**
 * SubmitButton - triggers annotation submission (export + seal version).
 * Disabled when the version is already sealed.
 */
export function SubmitButton({ sealed, onSubmit }: SubmitButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const handleSubmit = async () => {
    if (sealed || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await onSubmit();
      setFeedback({ type: 'success', message: 'Submitted successfully!' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Submit failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="submit-button-container">
      <button
        className={`submit-button ${sealed ? 'submit-button--disabled' : ''}`}
        onClick={handleSubmit}
        disabled={sealed || submitting}
      >
        {submitting ? 'Submitting...' : sealed ? 'Sealed' : 'Submit Annotations'}
      </button>
      {feedback && (
        <div className={`submit-button__feedback submit-button__feedback--${feedback.type}`}>
          {feedback.message}
        </div>
      )}
    </div>
  );
}
