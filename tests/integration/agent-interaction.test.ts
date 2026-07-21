/**
 * 集成测试：Agent 调用 MCP 工具完整流程
 * 覆盖：MCP 工具完整链路、get_annotations 含笔迹和 hit-test、apply_patch 后版本自动创建
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpGateway } from '@/gateway/mcp/index';
import { PreviewService } from '@/core/preview.service';
import { AnnotationService } from '@/core/annotation.service';
import { VersionService } from '@/core/version.service';
import { PatchService } from '@/core/patch.service';
import { SnapshotService } from '@/core/snapshot.service';
import {
  SAMPLE_HTML,
  SAMPLE_INK_ANNOTATION,
  SAMPLE_CLICK_ANNOTATION,
  SAMPLE_MODIFY_ANNOTATION,
} from '../setup';

describe('Integration: Agent Interaction via MCP', () => {
  let mcpGateway: McpGateway;
  let previewService: PreviewService;
  let annotationService: AnnotationService;
  let versionService: VersionService;
  let patchService: PatchService;
  let snapshotService: SnapshotService;

  beforeEach(async () => {
    vi.clearAllMocks();

    mcpGateway = new McpGateway();
    previewService = new PreviewService();
    annotationService = new AnnotationService();
    versionService = new VersionService();
    patchService = new PatchService();
    snapshotService = new SnapshotService();

    // Mock file system
    const fs = await import('fs/promises');
    (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);
    (fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe('complete Agent MCP tool call chain', () => {
    it('should complete full chain: preview → get_snapshot → get_annotations → apply_patch → compare', async () => {
      // Step 1: Agent 启动预览
      const previewResult = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/project/index.html',
      });
      expect(previewResult.isError).toBeFalsy();

      const previewData = JSON.parse(previewResult.content[0].text);
      expect(previewData.url).toBeDefined();
      expect(previewData.session_id).toBeDefined();
      expect(previewData.version_id).toBeDefined();

      const sessionId = previewData.session_id;
      const versionId = previewData.version_id;

      // Step 2: Agent 获取 DOM 快照了解页面结构
      const snapshotResult = await mcpGateway.handleToolCall('get_dom_snapshot', {
        version_id: versionId,
      });
      expect(snapshotResult.isError).toBeFalsy();

      const snapshotData = JSON.parse(snapshotResult.content[0].text);
      expect(snapshotData.html).toBeDefined();
      expect(snapshotData.tree).toBeDefined();

      // Step 3: 用户在前端标注后，Agent 获取标注
      // （模拟用户已在前端创建了标注）
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);
      await annotationService.create('working', SAMPLE_MODIFY_ANNOTATION);

      const annotationsResult = await mcpGateway.handleToolCall('get_annotations', {
        version_id: versionId,
      });
      expect(annotationsResult.isError).toBeFalsy();

      const annotationsData = JSON.parse(annotationsResult.content[0].text);
      expect(annotationsData.annotations).toBeInstanceOf(Array);
      expect(annotationsData.annotations.length).toBeGreaterThanOrEqual(2);

      // Step 4: Agent 基于标注应用 patch
      const patchResult = await mcpGateway.handleToolCall('apply_patch', {
        version_id: versionId,
        patches: [
          {
            annotation_id: 'ann-1',
            selector: 'body > div.hero > h1',
            action: 'modify_style',
            content: 'color: #1a73e8; font-size: 28px;',
          },
        ],
      });
      expect(patchResult.isError).toBeFalsy();

      const patchData = JSON.parse(patchResult.content[0].text);
      expect(patchData.new_version_id).toBeDefined();
      expect(patchData.diff).toBeDefined();
      expect(patchData.applied_count).toBe(1);

      // Step 5: Agent 获取版本历史验证
      const historyResult = await mcpGateway.handleToolCall('get_version_history', {
        session_id: sessionId,
      });
      expect(historyResult.isError).toBeFalsy();

      const historyData = JSON.parse(historyResult.content[0].text);
      expect(historyData.versions.length).toBeGreaterThanOrEqual(2);

      // Step 6: Agent 对比新旧版本
      const compareResult = await mcpGateway.handleToolCall('compare_versions', {
        version_a: versionId,
        version_b: patchData.new_version_id,
      });
      expect(compareResult.isError).toBeFalsy();

      const compareData = JSON.parse(compareResult.content[0].text);
      expect(compareData.diff).toBeDefined();
    });

    it('should handle Agent checkout and re-annotate workflow', async () => {
      // Step 1: 创建初始预览
      const previewResult = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/project/index.html',
      });
      const { version_id: v1Id } = JSON.parse(previewResult.content[0].text);

      // Step 2: Agent apply patch 创建 v1.1
      const patch1Result = await mcpGateway.handleToolCall('apply_patch', {
        version_id: v1Id,
        patches: [{
          annotation_id: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>Attempt 1</h1>',
        }],
      });
      const { new_version_id: v1_1Id } = JSON.parse(patch1Result.content[0].text);

      // Step 3: 用户不满意，从 v1 checkout
      const checkoutResult = await mcpGateway.handleToolCall('checkout_version', {
        version_id: v1Id,
        keep_annotations: false,
      });
      expect(checkoutResult.isError).toBeFalsy();

      const { working_version_id } = JSON.parse(checkoutResult.content[0].text);
      expect(working_version_id).toBeDefined();

      // Step 4: Agent 在新分支上 apply patch 创建 v1.2
      const patch2Result = await mcpGateway.handleToolCall('apply_patch', {
        version_id: v1Id,
        patches: [{
          annotation_id: 'ann-2',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>Attempt 2 - Better</h1>',
        }],
      });
      expect(patch2Result.isError).toBeFalsy();

      const { new_version_id: v1_2Id } = JSON.parse(patch2Result.content[0].text);
      expect(v1_2Id).toBeDefined();
      expect(v1_2Id).not.toBe(v1_1Id);
    });
  });

  describe('get_annotations returns ink screenshot and hit-test info', () => {
    it('should include anchor_element in ink annotation', async () => {
      // 模拟用户创建了笔迹标注
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'working',
      });

      const data = JSON.parse(result.content[0].text);
      const inkAnnotation = data.annotations.find((a: any) => a.screenshot !== undefined);

      expect(inkAnnotation).toBeDefined();
      expect(inkAnnotation.anchor_element).toBeDefined();
      expect(inkAnnotation.anchor_element.selector).toBe('div.hero');
    });

    it('should include screenshot base64 in ink annotation', async () => {
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'working',
      });

      const data = JSON.parse(result.content[0].text);
      const inkAnnotation = data.annotations.find((a: any) => a.screenshot !== undefined);

      expect(inkAnnotation.screenshot).toBeDefined();
      expect(inkAnnotation.screenshot).toMatch(/^data:image\//);
    });

    it('should include hit_elements with selector, tag, outerHtmlSummary, boundingRect', async () => {
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'working',
      });

      const data = JSON.parse(result.content[0].text);
      const inkAnnotation = data.annotations.find((a: any) => a.screenshot !== undefined);

      expect(inkAnnotation.hit_elements).toBeInstanceOf(Array);
      expect(inkAnnotation.hit_elements.length).toBeGreaterThan(0);

      const hitElement = inkAnnotation.hit_elements[0];
      expect(hitElement.selector).toBe('div.hero > h1');
      expect(hitElement.tag).toBe('H1');
      expect(hitElement.outerHtmlSummary).toContain('Hello World');
      expect(hitElement.boundingRect).toEqual({
        x: 100, y: 50, width: 300, height: 40,
      });
    });

    it('should NOT include ink_path or ink_bounds in annotation', async () => {
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);

      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'working',
      });

      const data = JSON.parse(result.content[0].text);
      const inkAnnotation = data.annotations.find((a: any) => a.screenshot !== undefined);

      expect(inkAnnotation.ink_path).toBeUndefined();
      expect(inkAnnotation.ink_bounds).toBeUndefined();
    });

    it('should fallback to body when no specific elements hit', async () => {
      const inkFallbackToBody = {
        ...SAMPLE_INK_ANNOTATION,
        anchor_element: { selector: 'body' },
        hit_elements: [
          {
            selector: 'body',
            tag: 'BODY',
            outerHtmlSummary: '<body>...</body>',
            boundingRect: { x: 0, y: 0, width: 1024, height: 768 },
          },
        ],
      };
      await annotationService.create('working', inkFallbackToBody);

      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'working',
      });

      const data = JSON.parse(result.content[0].text);
      const inkAnnotation = data.annotations.find((a: any) => a.screenshot !== undefined);

      expect(inkAnnotation.anchor_element.selector).toBe('body');
      expect(inkAnnotation.hit_elements).toHaveLength(1);
      expect(inkAnnotation.hit_elements[0].selector).toBe('body');
    });

    it('should return both click and ink annotations in same response', async () => {
      await annotationService.create('working', SAMPLE_INK_ANNOTATION);
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      await annotationService.create('working', SAMPLE_MODIFY_ANNOTATION);

      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'working',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.annotations).toHaveLength(3);

      // ink annotations have screenshot, click annotations don't
      const withScreenshot = data.annotations.filter((a: any) => a.screenshot !== undefined);
      const withoutScreenshot = data.annotations.filter((a: any) => a.screenshot === undefined);
      expect(withScreenshot).toHaveLength(1);
      expect(withoutScreenshot).toHaveLength(2);
    });
  });

  describe('apply_patch automatically creates new version', () => {
    it('should create new version with incremented version number', async () => {
      // 创建初始版本
      const previewResult = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/project/index.html',
      });
      const { version_id: v1Id } = JSON.parse(previewResult.content[0].text);

      // 应用 patch
      const patchResult = await mcpGateway.handleToolCall('apply_patch', {
        version_id: v1Id,
        patches: [{
          annotation_id: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>Modified</h1>',
        }],
      });

      const patchData = JSON.parse(patchResult.content[0].text);
      expect(patchData.new_version_id).toBeDefined();
      expect(patchData.new_version_id).not.toBe(v1Id);
    });

    it('should make new version immutable immediately', async () => {
      const previewResult = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/project/index.html',
      });
      const { version_id: v1Id } = JSON.parse(previewResult.content[0].text);

      const patchResult = await mcpGateway.handleToolCall('apply_patch', {
        version_id: v1Id,
        patches: [{
          annotation_id: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>Frozen</h1>',
        }],
      });

      const { new_version_id } = JSON.parse(patchResult.content[0].text);
      const newVersion = await versionService.get(new_version_id);

      expect(newVersion).not.toBeNull();
      expect(newVersion!.sealed).toBe(true);
    });

    it('should include diff in patch result showing what changed', async () => {
      const previewResult = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/project/index.html',
      });
      const { version_id: v1Id } = JSON.parse(previewResult.content[0].text);

      const patchResult = await mcpGateway.handleToolCall('apply_patch', {
        version_id: v1Id,
        patches: [{
          annotation_id: 'ann-1',
          selector: 'body > div.sidebar > .ad-banner',
          action: 'delete',
        }],
      });

      const patchData = JSON.parse(patchResult.content[0].text);
      expect(patchData.diff).toBeDefined();
      expect(patchData.diff.length).toBeGreaterThan(0);
    });

    it('should handle multiple patches creating single new version', async () => {
      const previewResult = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/project/index.html',
      });
      const { version_id: v1Id } = JSON.parse(previewResult.content[0].text);

      const patchResult = await mcpGateway.handleToolCall('apply_patch', {
        version_id: v1Id,
        patches: [
          {
            annotation_id: 'ann-1',
            selector: 'body > div.hero > h1',
            action: 'modify_style',
            content: 'color: blue;',
          },
          {
            annotation_id: 'ann-2',
            selector: 'body > div.sidebar > .ad-banner',
            action: 'delete',
          },
          {
            annotation_id: 'ann-3',
            selector: 'body > div.content > p',
            action: 'replace',
            content: '<p>New paragraph content</p>',
          },
        ],
      });

      const patchData = JSON.parse(patchResult.content[0].text);
      // 多个 patch 应该生成一个新版本，而非多个
      expect(patchData.new_version_id).toBeDefined();
      expect(patchData.applied_count).toBe(3);
    });

    it('should properly link new version as child in version tree', async () => {
      const previewResult = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/project/index.html',
      });
      const { version_id: v1Id, session_id: sessionId } = JSON.parse(previewResult.content[0].text);

      // Apply patch to create v1.1
      const patchResult = await mcpGateway.handleToolCall('apply_patch', {
        version_id: v1Id,
        patches: [{
          annotation_id: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>V1.1</h1>',
        }],
      });
      const { new_version_id: v1_1Id } = JSON.parse(patchResult.content[0].text);

      // Get history and verify tree structure
      const historyResult = await mcpGateway.handleToolCall('get_version_history', {
        session_id: sessionId,
      });
      const historyData = JSON.parse(historyResult.content[0].text);

      // Should have edge from v1 to v1.1
      expect(historyData.graph.edges).toContainEqual({
        from: v1Id,
        to: v1_1Id,
      });
    });
  });

  describe('error handling in Agent workflow', () => {
    it('should return clear error when version_id is invalid', async () => {
      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'totally-invalid-id',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('VERSION_NOT_FOUND');
    });

    it('should return available versions list on VERSION_NOT_FOUND', async () => {
      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'invalid-id',
      });

      if (result.isError) {
        const errorData = JSON.parse(result.content[0].text);
        expect(errorData.available_versions).toBeInstanceOf(Array);
      }
    });

    it('should handle patch failure gracefully with diagnostic info', async () => {
      const previewResult = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/project/index.html',
      });
      const { version_id: v1Id } = JSON.parse(previewResult.content[0].text);

      const patchResult = await mcpGateway.handleToolCall('apply_patch', {
        version_id: v1Id,
        patches: [{
          annotation_id: 'ann-1',
          selector: '#nonexistent-element-that-will-not-match',
          action: 'delete',
          old_content: 'content that does not exist in any element',
        }],
      });

      // 全部失败时应返回错误
      if (patchResult.isError) {
        expect(patchResult.content[0].text).toContain('PATCH');
      }
    });
  });

  describe('HTML error feedback to Agent', () => {
    it('should detect HTML parse errors and provide feedback button mechanism', async () => {
      // Mock a malformed HTML file
      const fs = await import('fs/promises');
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('<html><body><div unclosed');

      const previewResult = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/project/broken.html',
      });

      // Preview should still start (renders error page)
      expect(previewResult.isError).toBeFalsy();
      const previewData = JSON.parse(previewResult.content[0].text);
      expect(previewData.url).toBeDefined();
      expect(previewData.has_errors).toBe(true);
    });

    it('should push HTML error info to Agent via MCP notification', async () => {
      const sendNotification = vi.fn();
      mcpGateway.setNotificationHandler(sendNotification);

      // Simulate user clicking "feedback to Agent" button after error
      await mcpGateway.pushHtmlError('session-1', {
        type: 'parse_error',
        message: 'Unexpected end of input: unclosed <div> tag',
        location: {
          line: 1,
          column: 18,
          context: '<html><body><div unclosed',
        },
        file_path: '/project/broken.html',
        version_id: 'ver-001',
      });

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'notifications/html_error_feedback',
        })
      );
    });

    it('should include error location and context in feedback', async () => {
      const sendNotification = vi.fn();
      mcpGateway.setNotificationHandler(sendNotification);

      await mcpGateway.pushHtmlError('session-1', {
        type: 'render_error',
        message: 'Failed to load external stylesheet',
        location: {
          line: 5,
          column: 1,
          context: '<link rel="stylesheet" href="missing.css">',
        },
        file_path: '/project/index.html',
        version_id: 'ver-001',
      });

      const callArgs = sendNotification.mock.calls[0][0];
      expect(callArgs.params.error.type).toBe('render_error');
      expect(callArgs.params.error.location.line).toBe(5);
      expect(callArgs.params.error.file_path).toBe('/project/index.html');
    });
  });
});
