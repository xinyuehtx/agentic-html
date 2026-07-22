/**
 * toDataUrl 单元测试
 * 覆盖：空值、已是 data URL 的透传、裸 base64 的补全、空白裁剪
 */
import { describe, it, expect } from 'vitest';
import { toDataUrl } from '../../../src/ui/utils/toDataUrl';

describe('toDataUrl', () => {
  it('returns undefined for empty values', () => {
    expect(toDataUrl(undefined)).toBeUndefined();
    expect(toDataUrl(null)).toBeUndefined();
    expect(toDataUrl('')).toBeUndefined();
    expect(toDataUrl('   ')).toBeUndefined();
  });

  it('passes through existing data URLs unchanged', () => {
    const jpeg = 'data:image/jpeg;base64,/9j/abc123';
    expect(toDataUrl(jpeg)).toBe(jpeg);
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(toDataUrl(png)).toBe(png);
  });

  it('prefixes bare base64 as PNG', () => {
    expect(toDataUrl('iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('trims surrounding whitespace before deciding', () => {
    expect(toDataUrl('  data:image/jpeg;base64,xyz  ')).toBe('data:image/jpeg;base64,xyz');
  });
});
