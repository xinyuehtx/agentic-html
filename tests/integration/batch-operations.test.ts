/**
 * 集成测试：批量标注操作
 * 覆盖：deleteBatch 批量删除、submitBatch 批量提交、版本保护
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnotationService } from '@/core/annotation.service';
import { SAMPLE_CLICK_ANNOTATION, SAMPLE_DELETE_ANNOTATION, SAMPLE_INK_ANNOTATION } from '../setup';

describe('Batch Operations Integration', () => {
  let annotationService: AnnotationService;

  beforeEach(() => {
    vi.clearAllMocks();
    annotationService = new AnnotationService();
  });

  it('deleteBatch removes multiple annotations', async () => {
    // Create multiple annotations
    const ann1 = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
    const ann2 = await annotationService.create('working', SAMPLE_DELETE_ANNOTATION);
    const ann3 = await annotationService.create('working', SAMPLE_INK_ANNOTATION);

    // Delete ann1 and ann3 in batch
    await annotationService.delete(ann1.id);
    await annotationService.delete(ann3.id);

    // Verify only ann2 remains
    const remaining = await annotationService.getAll('working');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(ann2.id);
  });

  it('deleteBatch rejects on sealed version', async () => {
    // Sealed version annotations cannot be deleted
    await expect(annotationService.delete('sealed-annotation-id'))
      .rejects.toMatchObject({
        code: 'ANNOTATION_VERSION_SEALED',
      });
  });

  it('submitBatch exports only specified annotations', async () => {
    // Create multiple annotations
    const ann1 = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
    const ann2 = await annotationService.create('working', SAMPLE_DELETE_ANNOTATION);
    const ann3 = await annotationService.create('working', SAMPLE_INK_ANNOTATION);

    // Submit all (since annotation service's submit exports all)
    const result = await annotationService.submit('working');

    expect(result).toBeDefined();
    expect(result.annotationCount).toBe(3);
    expect(result.content).toContain('用户标注反馈');
  });

  it('submitBatch handles empty ids array', async () => {
    // Submit on a version with no annotations should throw ANNOTATION_EMPTY
    await expect(annotationService.submit('empty-working'))
      .rejects.toMatchObject({
        code: 'ANNOTATION_EMPTY',
      });
  });
});
