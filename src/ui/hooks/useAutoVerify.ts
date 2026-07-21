import { useState, useEffect, useCallback } from 'react';
import type { VerificationResult } from '../../core/types.js';
import type { WSMessage } from './useWebSocket';

export interface UseAutoVerifyReturn {
  verificationResult: VerificationResult | null;
  showBanner: boolean;
  dismissBanner: () => void;
}

/**
 * Hook for listening to verification_result WebSocket messages.
 * Integrates with the existing useWebSocket infrastructure.
 */
export function useAutoVerify(lastMessage: WSMessage | null): UseAutoVerifyReturn {
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  // Listen for verification_result messages from WebSocket
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'verification_result') {
      const result = lastMessage.result as VerificationResult;
      setVerificationResult(result);
      setShowBanner(true);

      // Auto-dismiss after 3 seconds if passed
      if (result.passed) {
        const timer = setTimeout(() => setShowBanner(false), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [lastMessage]);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  return { verificationResult, showBanner, dismissBanner };
}
