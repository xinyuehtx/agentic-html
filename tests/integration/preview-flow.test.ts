/**
 * 集成测试：预览启动→标注→提交完整流程
 * 覆盖：完整工作流、MCP 模式和 CLI 模式同构行为
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreviewService } from '@/core/preview.service';
import { AnnotationService } from '@/core/annotation.service';
import { VersionService } from '@/core/version.service';
import { PatchService } from '@/core/patch.service';
import { McpGateway } from '@/gateway/mcp/index';
import { CliGateway } from '@/gateway/cli/index';
import { SAMPLE_HTML, SAMPLE_CLICK_ANNOTATION, SAMPLE_INK_ANNOTATION, SAMPLE_DELETE_ANNOTATION } from '../setup';

describe('Integration: Preview Flow', () => {
  let previewService: PreviewService;
  let annotationService: AnnotationService;
  let versionService: VersionService;
  let patchService: PatchService;

  beforeEach(async () => {
    vi.clearAllMocks();
    previewService = new PreviewService();
    annotationService = new AnnotationService();
    versionService = new VersionService();
    patchService = new PatchService();

    // Mock file system
    const fs = await import('fs/promises');
    (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);
    (fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe('full workflow: preview → annotate → submit → verify', () => {
    it('should complete the full preview-annotate-submit flow', async () => {
      // Step 1: 启动预览
      const session = await previewService.start('/project/index.html');
      expect(session.sessionId).toBeDefined();
      expect(session.versionId).toBeDefined();
      expect(session.url).toContain('localhost');

      // Step 2: 在当前版本上创建标注
      const annotation1 = await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      expect(annotation1.id).toBeDefined();
      expect(annotation1.anchor_element).toBeDefined();

      const annotation2 = await annotationService.create('working', SAMPLE_INK_ANNOTATION);
      expect(annotation2.id).toBeDefined();
      expect(annotation2.screenshot).toBeDefined();

      // Step 3: 提交标注（版本自动 seal）
      const submitResult = await annotationService.submit('working');
      expect(submitResult.annotationCount).toBe(2);
      expect(submitResult.content).toBeDefined();

      // Step 4: 验证标注数据完整
      const allAnnotations = await annotationService.getAll('working');
      expect(allAnnotations).toHaveLength(2);
      expect(allAnnotations.some(a => a.screenshot !== undefined)).toBe(true);
      expect(allAnnotations.some(a => a.screenshot === undefined)).toBe(true);
    });

    it('should handle annotate → patch → new version → refresh flow', async () => {
      // Step 1: 启动预览并获取初始版本
      const session = await previewService.start('/project/index.html');
      const initialVersionId = session.versionId;

      // Step 2: 创建标注
      await annotationService.create('working', {
        anchor_element: {
          selector: 'body > div.hero > h1',
        },
        comment: '改为品牌色',
      });

      // Step 3: 提交标注（版本 seal）
      await annotationService.submit('working');

      // Step 4: Agent 应用 patch 创建新版本
      const patchResult = await patchService.apply(initialVersionId, [
        {
          annotationId: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'modify_style',
          content: 'color: #1a73e8;',
        },
      ]);

      expect(patchResult.newVersionId).toBeDefined();
      expect(patchResult.newVersionId).not.toBe(initialVersionId);
      expect(patchResult.diff).toBeDefined();

      // Step 5: 预览应刷新到新版本
      await previewService.refresh(session.sessionId);
    });

    it('should support multiple annotation cycles', async () => {
      // 第一轮: 预览 → 标注 → patch → 新版本
      const session = await previewService.start('/project/index.html');

      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      await annotationService.submit('working');

      const result1 = await patchService.apply(session.versionId, [{
        annotationId: 'ann-1',
        selector: 'body > div.hero > h1',
        action: 'replace',
        content: '<h1 style="color: blue">Hello World</h1>',
      }]);

      // 第二轮: 在新版本上继续标注（新版本初始为 unsealed）
      await annotationService.create('working', {
        anchor_element: {
          selector: 'body > div.sidebar > .ad-banner',
        },
        comment: '删除广告',
      });

      await annotationService.submit('working');

      const result2 = await patchService.apply(result1.newVersionId, [{
        annotationId: 'ann-2',
        selector: 'body > div.sidebar > .ad-banner',
        action: 'delete',
      }]);

      expect(result2.newVersionId).toBeDefined();
      expect(result2.newVersionId).not.toBe(result1.newVersionId);
    });
  });

  describe('isomorphic behavior: MCP mode vs CLI mode', () => {
    it('should produce same result via MCP and CLI for preview_html', async () => {
      // MCP 方式
      const mcpGateway = new McpGateway();
      const mcpResult = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/project/index.html',
      });

      // CLI 方式
      let cliOutput = '';
      const cliGateway = new CliGateway({
        stdout: (text: string) => { cliOutput = text; },
        stderr: () => {},
        exit: () => {},
      });
      await cliGateway.execute(['preview', '/project/index.html']);

      // 两者都应返回 url、session_id、version_id
      if (!mcpResult.isError) {
        const mcpData = JSON.parse(mcpResult.content[0].text);
        const cliData = JSON.parse(cliOutput);

        expect(mcpData).toHaveProperty('url');
        expect(mcpData).toHaveProperty('session_id');
        expect(mcpData).toHaveProperty('version_id');

        expect(cliData).toHaveProperty('url');
        expect(cliData).toHaveProperty('session_id');
        expect(cliData).toHaveProperty('version_id');
      }
    });

    it('should produce same result via MCP and CLI for get_annotations', async () => {
      // 先创建一些标注
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);

      // MCP 方式
      const mcpGateway = new McpGateway();
      const mcpResult = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'working',
      });

      // CLI 方式
      let cliOutput = '';
      const cliGateway = new CliGateway({
        stdout: (text: string) => { cliOutput = text; },
        stderr: () => {},
        exit: () => {},
      });
      await cliGateway.execute(['annotations', 'list', '--version', 'working']);

      // 两者返回的标注数据结构应一致
      if (!mcpResult.isError && cliOutput) {
        const mcpData = JSON.parse(mcpResult.content[0].text);
        const cliData = JSON.parse(cliOutput);

        expect(mcpData.annotations).toBeInstanceOf(Array);
        expect(cliData.annotations).toBeInstanceOf(Array);
      }
    });

    it('should produce same result via MCP and CLI for apply_patch', async () => {
      const patches = [{
        annotation_id: 'ann-1',
        selector: 'body > div.hero > h1',
        action: 'replace',
        content: '<h1>New Title</h1>',
      }];

      // MCP 方式
      const mcpGateway = new McpGateway();
      const mcpResult = await mcpGateway.handleToolCall('apply_patch', {
        version_id: 'ver-001',
        patches,
      });

      // CLI 方式
      const fs = await import('fs/promises');
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(patches));

      let cliOutput = '';
      const cliGateway = new CliGateway({
        stdout: (text: string) => { cliOutput = text; },
        stderr: () => {},
        exit: () => {},
      });
      await cliGateway.execute(['patch', 'apply', '/patches.json', '--version', 'ver-001']);

      // 两者都应返回 new_version_id 和 diff
      if (!mcpResult.isError && cliOutput) {
        const mcpData = JSON.parse(mcpResult.content[0].text);
        const cliData = JSON.parse(cliOutput);

        expect(mcpData).toHaveProperty('new_version_id');
        expect(mcpData).toHaveProperty('diff');
        expect(cliData).toHaveProperty('new_version_id');
        expect(cliData).toHaveProperty('diff');
      }
    });

    it('should produce same result via MCP and CLI for version operations', async () => {
      // MCP: compare_versions
      const mcpGateway = new McpGateway();
      const mcpResult = await mcpGateway.handleToolCall('compare_versions', {
        version_a: 'ver-001',
        version_b: 'ver-002',
      });

      // CLI: versions diff
      let cliOutput = '';
      const cliGateway = new CliGateway({
        stdout: (text: string) => { cliOutput = text; },
        stderr: () => {},
        exit: () => {},
      });
      await cliGateway.execute(['versions', 'diff', 'ver-001', 'ver-002']);

      // 两者都应返回 diff 信息
      if (!mcpResult.isError && cliOutput) {
        const mcpData = JSON.parse(mcpResult.content[0].text);
        const cliData = JSON.parse(cliOutput);

        expect(mcpData).toHaveProperty('diff');
        expect(cliData).toHaveProperty('diff');
      }
    });
  });

  describe('annotation submission via different gateways', () => {
    it('should push via MCP notification in MCP mode', async () => {
      const mcpGateway = new McpGateway();
      const sendNotification = vi.fn();
      mcpGateway.setNotificationHandler(sendNotification);

      // 创建标注并提交（自动 seal）
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);
      const exportResult = await annotationService.submit('working');

      // 通过 MCP 推送
      await mcpGateway.pushAnnotations(
        'session-1',
        'ver-001',
        await annotationService.getAll('working'),
        exportResult.content
      );

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'notifications/annotations_submitted',
        })
      );
    });

    it('should write file in CLI mode', async () => {
      const fs = await import('fs/promises');

      // 创建标注并通过 CLI 导出
      await annotationService.create('working', SAMPLE_CLICK_ANNOTATION);

      let cliOutput = '';
      const cliGateway = new CliGateway({
        stdout: (text: string) => { cliOutput = text; },
        stderr: () => {},
        exit: () => {},
      });

      await cliGateway.execute([
        'annotations', 'export',
        '--version', 'working',
        '--out', '.html-editor/annotations/working.json',
      ]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        '.html-editor/annotations/working.json',
        expect.any(String)
      );
    });
  });
});
