/**
 * useAnnotationSelection 单元测试
 * 覆盖：toggle/toggleRange/selectAll/clearSelection/isSelected/selectedCount
 *
 * We mock React's useState/useCallback/useRef to test hook logic directly
 * without needing a React rendering environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track state externally
let stateValue: Set<string> = new Set();
let lastClickedRef = { current: null as string | null };

vi.mock('react', () => {
  return {
    useState: (initial: any) => {
      return [stateValue, (updater: any) => {
        if (typeof updater === 'function') {
          stateValue = updater(stateValue);
        } else {
          stateValue = updater;
        }
      }];
    },
    useCallback: (fn: any) => fn,
    useRef: (initial: any) => {
      return lastClickedRef;
    },
  };
});

import { useAnnotationSelection } from '../../../src/ui/hooks/useAnnotationSelection';

describe('useAnnotationSelection', () => {
  let hook: ReturnType<typeof useAnnotationSelection>;

  beforeEach(() => {
    stateValue = new Set();
    lastClickedRef = { current: null };
    hook = useAnnotationSelection();
  });

  it('toggle adds and removes from selection', () => {
    hook.toggle('a1');
    expect(stateValue.has('a1')).toBe(true);

    // Toggle again to remove
    hook.toggle('a1');
    expect(stateValue.has('a1')).toBe(false);
  });

  it('toggleRange selects range between last clicked and current', () => {
    const allIds = ['a1', 'a2', 'a3', 'a4', 'a5'];

    // First toggle sets lastClicked
    hook.toggle('a2');
    // lastClickedRef is set inside toggle via lastClickedIdRef.current = id

    // Now toggle range to a4
    hook.toggleRange('a4', allIds);

    expect(stateValue.has('a2')).toBe(true);
    expect(stateValue.has('a3')).toBe(true);
    expect(stateValue.has('a4')).toBe(true);
  });

  it('selectAll selects all provided ids', () => {
    const allIds = ['a1', 'a2', 'a3'];
    hook.selectAll(allIds);
    expect(stateValue.size).toBe(3);
    expect(stateValue.has('a1')).toBe(true);
    expect(stateValue.has('a2')).toBe(true);
    expect(stateValue.has('a3')).toBe(true);
  });

  it('clearSelection empties the set', () => {
    stateValue = new Set(['a1', 'a2']);
    hook.clearSelection();
    expect(stateValue.size).toBe(0);
  });

  it('isSelected returns correct boolean', () => {
    stateValue = new Set(['a1', 'a3']);
    // Need to re-get hook to pick up new state
    hook = useAnnotationSelection();
    expect(hook.isSelected('a1')).toBe(true);
    expect(hook.isSelected('a2')).toBe(false);
    expect(hook.isSelected('a3')).toBe(true);
  });

  it('selectedCount reflects current selection size', () => {
    stateValue = new Set(['a1', 'a2', 'a3']);
    hook = useAnnotationSelection();
    expect(hook.selectedCount).toBe(3);
  });
});
