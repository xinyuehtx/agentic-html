/**
 * useAnnotations batch operations 单元测试
 * 覆盖：batchDelete/batchSubmit API 调用及乐观更新逻辑
 *
 * We mock React hooks and global fetch to test the hook logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock React hooks - track state externally
let annotations: any[] = [];
let loadingState = false;
let errorState: string | null = null;

let stateCallCount = 0;

vi.mock('react', () => ({
  useState: (initial: any) => {
    const idx = stateCallCount++;
    if (idx % 3 === 0) {
      // annotations state
      return [annotations, (updater: any) => {
        if (typeof updater === 'function') {
          annotations = updater(annotations);
        } else {
          annotations = updater;
        }
      }];
    } else if (idx % 3 === 1) {
      // loading state
      return [loadingState, (v: any) => { loadingState = v; }];
    } else {
      // error state
      return [errorState, (v: any) => { errorState = v; }];
    }
  },
  useCallback: (fn: any) => fn,
}));

// Mock global fetch
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

import { useAnnotations } from '../../../src/ui/hooks/useAnnotations';

describe('useAnnotations batch operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateCallCount = 0;
    annotations = [
      { id: 'ann-1', comment: 'First', anchor_element: { selector: '.a' }, status: 'pending', timestamp: 'T1', version_id: 'v1' },
      { id: 'ann-2', comment: 'Second', anchor_element: { selector: '.b' }, status: 'pending', timestamp: 'T2', version_id: 'v1' },
      { id: 'ann-3', comment: 'Third', anchor_element: { selector: '.c' }, status: 'pending', timestamp: 'T3', version_id: 'v1' },
    ];
    loadingState = false;
    errorState = null;
  });

  function getHook() {
    stateCallCount = 0;
    return useAnnotations();
  }

  it('batchDelete calls DELETE /api/annotations/batch with ids', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const hook = getHook();

    await hook.batchDelete(['ann-1', 'ann-2']);

    expect(mockFetch).toHaveBeenCalledWith('/api/annotations/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['ann-1', 'ann-2'] }),
    });
  });

  it('batchDelete optimistically removes items from list', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const hook = getHook();

    await hook.batchDelete(['ann-1', 'ann-3']);

    // After optimistic update, only ann-2 should remain
    expect(annotations.length).toBe(1);
    expect(annotations[0].id).toBe('ann-2');
  });

  it('batchDelete rolls back on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const hook = getHook();

    await hook.batchDelete(['ann-1']);

    // On failure, annotations should be rolled back
    expect(annotations.length).toBe(3);
    expect(errorState).toContain('Failed to batch delete');
  });

  it('batchSubmit calls POST /api/annotations/batch/submit', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const hook = getHook();

    await hook.batchSubmit('ver-001', ['ann-1', 'ann-2']);

    expect(mockFetch).toHaveBeenCalledWith('/api/annotations/batch/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_id: 'ver-001', ids: ['ann-1', 'ann-2'] }),
    });
  });

  it('batchSubmit sends version_id and ids', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const hook = getHook();

    await hook.batchSubmit('my-version', ['ann-3']);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.version_id).toBe('my-version');
    expect(body.ids).toEqual(['ann-3']);
  });
});
