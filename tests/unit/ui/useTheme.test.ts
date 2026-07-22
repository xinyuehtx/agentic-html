/**
 * useTheme.resolveTheme 单元测试
 * 覆盖：stored 优先、OS 偏好回退、非法值回退、dark 默认
 */
import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../../../src/ui/hooks/useTheme';

describe('resolveTheme', () => {
  it('honors a stored preference over the OS preference', () => {
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('light');
    expect(resolveTheme(null, false)).toBe('dark');
  });

  it('defaults to dark for invalid stored values', () => {
    expect(resolveTheme('purple', false)).toBe('dark');
    expect(resolveTheme('', false)).toBe('dark');
  });

  it('still respects OS light preference for invalid stored values', () => {
    expect(resolveTheme('nonsense', true)).toBe('light');
  });
});
