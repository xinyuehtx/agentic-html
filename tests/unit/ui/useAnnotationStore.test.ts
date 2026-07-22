/**
 * useAnnotationStore.buildStoreAnnotation 单元测试
 * 覆盖：element/ink 来源字段映射、默认 comment/status、versionId 处理、id/timestamp 透传
 */
import { describe, it, expect } from 'vitest';
import { buildStoreAnnotation } from '../../../src/ui/hooks/useAnnotationStore';

describe('buildStoreAnnotation', () => {
  it('maps an element capture with defaults', () => {
    const a = buildStoreAnnotation(
      { source: 'element', anchor_element: { selector: 'div.hero > h1' } },
      'ver-1',
      'ann-1',
      '2026-07-22T00:00:00.000Z',
    );
    expect(a).toMatchObject({
      id: 'ann-1',
      source: 'element',
      comment: '',
      status: 'pending',
      version_id: 'ver-1',
      timestamp: '2026-07-22T00:00:00.000Z',
      anchor_element: { selector: 'div.hero > h1' },
    });
  });

  it('uses an empty version_id when versionId is null', () => {
    const a = buildStoreAnnotation(
      { source: 'element', anchor_element: { selector: 'body' } },
      null,
      'ann-2',
      '2026-07-22T00:00:00.000Z',
    );
    expect(a.version_id).toBe('');
  });

  it('preserves ink metadata (screenshot, hit_elements, anchor, note)', () => {
    const a = buildStoreAnnotation(
      {
        source: 'ink',
        anchor_element: { selector: 'section.features' },
        comment: 'tighten spacing',
        screenshot: 'data:image/jpeg;base64,zzz',
        hit_elements: [
          { selector: 'h3', tag: 'H3', outerHtmlSummary: '<h3>x</h3>', boundingRect: { x: 0, y: 0, width: 10, height: 10 } },
        ],
        anchor: { x: 120, y: 240 },
      },
      'ver-9',
      'ann-3',
      '2026-07-22T01:00:00.000Z',
    );
    expect(a.source).toBe('ink');
    expect(a.comment).toBe('tighten spacing');
    expect(a.screenshot).toBe('data:image/jpeg;base64,zzz');
    expect(a.hit_elements).toHaveLength(1);
    expect(a.anchor).toEqual({ x: 120, y: 240 });
  });
});
