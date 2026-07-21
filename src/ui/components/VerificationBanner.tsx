import type { VerificationResult } from '../../core/types.js';

export interface VerificationBannerProps {
  result: VerificationResult;
  onDismiss: () => void;
}

export function VerificationBanner({ result, onDismiss }: VerificationBannerProps) {
  if (result.passed) {
    return (
      <div className="verification-banner verification-banner--passed">
        <span>✓ All changes verified</span>
        <button onClick={onDismiss}>×</button>
      </div>
    );
  }

  return (
    <div className="verification-banner verification-banner--failed">
      <div className="verification-banner__header">
        <span>⚠ Verification Alert</span>
        <button onClick={onDismiss}>×</button>
      </div>
      <div className="verification-banner__summary">{result.summary}</div>
      <div className="verification-banner__details">
        {result.unexpectedChanges.length > 0 && (
          <details>
            <summary>Unexpected changes ({result.unexpectedChanges.length})</summary>
            <ul>
              {result.unexpectedChanges.map((c, i) => (
                <li key={i} className={`verification-change--${c.severity}`}>
                  [{c.severity}] {c.description}
                </li>
              ))}
            </ul>
          </details>
        )}
        {result.visualComparison && (
          <div className="verification-banner__visual">
            Visual diff: {result.visualComparison.diffPercentage}%
            {result.visualComparison.diffImagePath && (
              <a href={result.visualComparison.diffImagePath} target="_blank" rel="noopener">
                View diff
              </a>
            )}
          </div>
        )}
      </div>
      <div className="verification-banner__status">Agent has been notified</div>
    </div>
  );
}
