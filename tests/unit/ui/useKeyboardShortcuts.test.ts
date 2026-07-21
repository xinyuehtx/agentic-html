/**
 * useKeyboardShortcuts 单元测试
 * 覆盖：快捷键映射、输入框跳过、submitting 阶段屏蔽
 *
 * Since the test environment is Node (no jsdom), we mock document and React's useEffect
 * to directly test the event handler logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Capture the handler registered via addEventListener
let capturedHandler: ((e: any) => void) | null = null;
let mockActiveElement: any = null;

// Mock document globally for this test file
const mockDocument = {
  addEventListener: vi.fn((event: string, handler: any) => {
    if (event === 'keydown') {
      capturedHandler = handler;
    }
  }),
  removeEventListener: vi.fn(),
  get activeElement() {
    return mockActiveElement;
  },
};

// Set up global document before React module loads
(globalThis as any).document = mockDocument;

// Mock React - useEffect is invoked synchronously
vi.mock('react', () => ({
  useEffect: (cb: () => (() => void) | void) => {
    cb();
  },
}));

// Now import the hook (after mocks are set up)
import { useKeyboardShortcuts } from '../../../src/ui/hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let onModeChange: ReturnType<typeof vi.fn>;
  let onSubmit: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;
  let onSelectAll: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onModeChange = vi.fn();
    onSubmit = vi.fn();
    onDelete = vi.fn();
    onSelectAll = vi.fn();
    capturedHandler = null;
    mockActiveElement = null;
    mockDocument.addEventListener.mockClear();
    mockDocument.removeEventListener.mockClear();
  });

  function setupHook(phase: string = 'idle', mode: string = 'browse', sealed = false) {
    useKeyboardShortcuts({
      appState: { mode: mode as any, phase: phase as any, sealed },
      onModeChange,
      onSubmit,
      onDelete,
      onSelectAll,
    });
  }

  function fireKey(code: string, opts: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}): void {
    const event = {
      code,
      key: code,
      ctrlKey: opts.ctrlKey ?? false,
      metaKey: opts.metaKey ?? false,
      altKey: opts.altKey ?? false,
      shiftKey: opts.shiftKey ?? false,
      preventDefault: vi.fn(),
    };
    capturedHandler!(event);
  }

  it('Ctrl+Enter triggers onSubmit', () => {
    setupHook('idle');
    fireKey('Enter', { ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Cmd+Enter triggers onSubmit on macOS', () => {
    setupHook('idle');
    fireKey('Enter', { metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Escape triggers onModeChange to browse', () => {
    setupHook('idle');
    fireKey('Escape');
    expect(onModeChange).toHaveBeenCalledWith('browse');
  });

  it('1/2/3 keys switch modes', () => {
    setupHook('idle');
    fireKey('Digit1');
    expect(onModeChange).toHaveBeenCalledWith('browse');

    fireKey('Digit2');
    expect(onModeChange).toHaveBeenCalledWith('ink');

    fireKey('Digit3');
    expect(onModeChange).toHaveBeenCalledWith('select');
  });

  it('Delete triggers onDelete', () => {
    setupHook('idle');
    fireKey('Delete');
    expect(onDelete).toHaveBeenCalledTimes(1);

    fireKey('Backspace');
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  it('Ctrl+A triggers onSelectAll', () => {
    setupHook('idle');
    fireKey('KeyA', { ctrlKey: true });
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('skips when activeElement is input', () => {
    setupHook('idle');

    // Simulate activeElement being an input
    mockActiveElement = { tagName: 'INPUT', isContentEditable: false };
    fireKey('Escape');
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it('disabled during submitting phase (except Escape)', () => {
    setupHook('submitting');

    // Escape should still work
    fireKey('Escape');
    expect(onModeChange).toHaveBeenCalledWith('browse');

    // Others should be blocked
    fireKey('Enter', { ctrlKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireKey('Delete');
    expect(onDelete).not.toHaveBeenCalled();

    fireKey('KeyA', { ctrlKey: true });
    expect(onSelectAll).not.toHaveBeenCalled();
  });
});
