import { VersionDiff } from '../hooks/useVersionGraph';

interface VersionDiffModalProps {
  diff: VersionDiff;
  loading: boolean;
  onClose: () => void;
}

/**
 * VersionDiffModal - displays a unified diff between two versions.
 * Shows additions/deletions statistics and line-level highlights.
 */
export function VersionDiffModal({ diff, loading, onClose }: VersionDiffModalProps) {
  return (
    <div className="version-diff-modal">
      <div className="version-diff-modal__backdrop" onClick={onClose} />
      <div className="version-diff-modal__content">
        <div className="version-diff-modal__header">
          <div>
            <div className="version-diff-modal__title">Version Diff</div>
            <div className="version-diff-modal__stats">
              <span className="version-diff-modal__additions">
                +{diff.additions} additions
              </span>
              <span className="version-diff-modal__deletions">
                -{diff.deletions} deletions
              </span>
            </div>
          </div>
          <button
            className="version-diff-modal__close"
            onClick={onClose}
            aria-label="Close diff"
          >
            ✕
          </button>
        </div>

        <div className="version-diff-modal__body">
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              Loading diff...
            </div>
          ) : (
            diff.hunks.map((hunk, idx) => (
              <div
                key={idx}
                className={`version-diff-modal__hunk version-diff-modal__hunk--${hunk.type}`}
              >
                {hunk.type === 'add' && '+ '}
                {hunk.type === 'remove' && '- '}
                {hunk.type === 'context' && '  '}
                {hunk.content}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
