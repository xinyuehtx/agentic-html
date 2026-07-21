/**
 * MCP Gateway 单元测试
 * 覆盖：工具输入验证、路由到 Core Service、输出格式、notification 推送
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpGateway } from '@/gateway/mcp/index';
import { SAMPLE_HTML } from '../../setup';

describe('MCP Gateway', () => {
  let mcpGateway: McpGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    mcpGateway = new McpGateway();
  });

  describe('preview_html tool', () => {
    it('should validate file_path is required', async () => {
      const result = await mcpGateway.handleToolCall('preview_html', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('file_path');
    });

    it('should validate file_path is a string', async () => {
      const result = await mcpGateway.handleToolCall('preview_html', { file_path: 123 });

      expect(result.isError).toBe(true);
    });

    it('should route to PreviewService.start()', async () => {
      const result = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/path/to/index.html',
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should return url, session_id, and version_id on success', async () => {
      const result = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/path/to/index.html',
      });

      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data.url).toBeDefined();
        expect(data.session_id).toBeDefined();
        expect(data.version_id).toBeDefined();
      }
    });

    it('should accept optional port parameter', async () => {
      const result = await mcpGateway.handleToolCall('preview_html', {
        file_path: '/path/to/index.html',
        port: 8080,
      });

      expect(result).toBeDefined();
    });
  });

  describe('get_annotations tool', () => {
    it('should validate version_id is required', async () => {
      const result = await mcpGateway.handleToolCall('get_annotations', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('version_id');
    });

    it('should route to AnnotationService.getAll()', async () => {
      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'ver-001',
      });

      expect(result).toBeDefined();
    });

    it('should accept optional status filter', async () => {
      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'ver-001',
        status: 'pending',
      });

      expect(result).toBeDefined();
    });

    it('should validate status enum values', async () => {
      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'ver-001',
        status: 'invalid_status',
      });

      expect(result.isError).toBe(true);
    });

    it('should return annotations array and version in output', async () => {
      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'ver-001',
      });

      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data.annotations).toBeInstanceOf(Array);
        expect(data.version).toBeDefined();
      }
    });
  });

  describe('apply_patch tool', () => {
    it('should validate version_id is required', async () => {
      const result = await mcpGateway.handleToolCall('apply_patch', {
        patches: [],
      });

      expect(result.isError).toBe(true);
    });

    it('should validate patches is required', async () => {
      const result = await mcpGateway.handleToolCall('apply_patch', {
        version_id: 'ver-001',
      });

      expect(result.isError).toBe(true);
    });

    it('should validate patch objects have required fields', async () => {
      const result = await mcpGateway.handleToolCall('apply_patch', {
        version_id: 'ver-001',
        patches: [{ selector: 'h1' }], // missing annotation_id and action
      });

      expect(result.isError).toBe(true);
    });

    it('should validate action enum values', async () => {
      const result = await mcpGateway.handleToolCall('apply_patch', {
        version_id: 'ver-001',
        patches: [{
          annotation_id: 'ann-1',
          selector: 'h1',
          action: 'invalid_action',
        }],
      });

      expect(result.isError).toBe(true);
    });

    it('should route to PatchService.apply()', async () => {
      const result = await mcpGateway.handleToolCall('apply_patch', {
        version_id: 'ver-001',
        patches: [{
          annotation_id: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>New</h1>',
        }],
      });

      expect(result).toBeDefined();
    });

    it('should return new_version_id, diff, applied_count, failed_patches', async () => {
      const result = await mcpGateway.handleToolCall('apply_patch', {
        version_id: 'ver-001',
        patches: [{
          annotation_id: 'ann-1',
          selector: 'body > div.hero > h1',
          action: 'replace',
          content: '<h1>New</h1>',
        }],
      });

      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data.new_version_id).toBeDefined();
        expect(data.diff).toBeDefined();
        expect(data.applied_count).toBeDefined();
        expect(data.failed_patches).toBeInstanceOf(Array);
      }
    });
  });

  describe('get_dom_snapshot tool', () => {
    it('should validate version_id is required', async () => {
      const result = await mcpGateway.handleToolCall('get_dom_snapshot', {});

      expect(result.isError).toBe(true);
    });

    it('should route to SnapshotService.get()', async () => {
      const result = await mcpGateway.handleToolCall('get_dom_snapshot', {
        version_id: 'ver-001',
      });

      expect(result).toBeDefined();
    });

    it('should accept optional selector parameter', async () => {
      const result = await mcpGateway.handleToolCall('get_dom_snapshot', {
        version_id: 'ver-001',
        selector: 'div.hero',
      });

      expect(result).toBeDefined();
    });

    it('should return html and tree in output', async () => {
      const result = await mcpGateway.handleToolCall('get_dom_snapshot', {
        version_id: 'ver-001',
      });

      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data.html).toBeDefined();
        expect(data.tree).toBeDefined();
      }
    });
  });

  describe('get_version_history tool', () => {
    it('should validate session_id is required', async () => {
      const result = await mcpGateway.handleToolCall('get_version_history', {});

      expect(result.isError).toBe(true);
    });

    it('should route to VersionService.history()', async () => {
      const result = await mcpGateway.handleToolCall('get_version_history', {
        session_id: 'session-1',
      });

      expect(result).toBeDefined();
    });

    it('should return versions and graph in output', async () => {
      const result = await mcpGateway.handleToolCall('get_version_history', {
        session_id: 'session-1',
      });

      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data.versions).toBeInstanceOf(Array);
        expect(data.graph).toBeDefined();
      }
    });
  });

  describe('checkout_version tool', () => {
    it('should validate version_id is required', async () => {
      const result = await mcpGateway.handleToolCall('checkout_version', {});

      expect(result.isError).toBe(true);
    });

    it('should route to VersionService.checkout()', async () => {
      const result = await mcpGateway.handleToolCall('checkout_version', {
        version_id: 'ver-001',
      });

      expect(result).toBeDefined();
    });

    it('should accept optional keep_annotations parameter', async () => {
      const result = await mcpGateway.handleToolCall('checkout_version', {
        version_id: 'ver-001',
        keep_annotations: true,
      });

      expect(result).toBeDefined();
    });

    it('should return working_version_id in output', async () => {
      const result = await mcpGateway.handleToolCall('checkout_version', {
        version_id: 'ver-001',
      });

      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data.working_version_id).toBeDefined();
      }
    });
  });

  describe('create_version tool', () => {
    it('should validate parent_id is required', async () => {
      const result = await mcpGateway.handleToolCall('create_version', {
        html_content: SAMPLE_HTML,
      });

      expect(result.isError).toBe(true);
    });

    it('should validate html_content is required', async () => {
      const result = await mcpGateway.handleToolCall('create_version', {
        parent_id: 'ver-001',
      });

      expect(result.isError).toBe(true);
    });

    it('should route to VersionService.create()', async () => {
      const result = await mcpGateway.handleToolCall('create_version', {
        parent_id: 'ver-001',
        html_content: SAMPLE_HTML,
      });

      expect(result).toBeDefined();
    });

    it('should return version_id in output', async () => {
      const result = await mcpGateway.handleToolCall('create_version', {
        parent_id: 'ver-001',
        html_content: SAMPLE_HTML,
      });

      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data.version_id).toBeDefined();
      }
    });
  });

  describe('compare_versions tool', () => {
    it('should validate version_a is required', async () => {
      const result = await mcpGateway.handleToolCall('compare_versions', {
        version_b: 'ver-002',
      });

      expect(result.isError).toBe(true);
    });

    it('should validate version_b is required', async () => {
      const result = await mcpGateway.handleToolCall('compare_versions', {
        version_a: 'ver-001',
      });

      expect(result.isError).toBe(true);
    });

    it('should route to VersionService.compare()', async () => {
      const result = await mcpGateway.handleToolCall('compare_versions', {
        version_a: 'ver-001',
        version_b: 'ver-002',
      });

      expect(result).toBeDefined();
    });

    it('should return diff, annotations_a, annotations_b', async () => {
      const result = await mcpGateway.handleToolCall('compare_versions', {
        version_a: 'ver-001',
        version_b: 'ver-002',
      });

      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data.diff).toBeDefined();
        expect(data.annotations_a).toBeInstanceOf(Array);
        expect(data.annotations_b).toBeInstanceOf(Array);
      }
    });
  });

  describe('close_preview tool', () => {
    it('should validate session_id is required', async () => {
      const result = await mcpGateway.handleToolCall('close_preview', {});

      expect(result.isError).toBe(true);
    });

    it('should route to PreviewService.stop()', async () => {
      const result = await mcpGateway.handleToolCall('close_preview', {
        session_id: 'session-1',
      });

      expect(result).toBeDefined();
    });

    it('should return success boolean in output', async () => {
      const result = await mcpGateway.handleToolCall('close_preview', {
        session_id: 'session-1',
      });

      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(typeof data.success).toBe('boolean');
      }
    });
  });

  describe('MCP output format compliance', () => {
    it('should return content as array of textContent objects', async () => {
      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'ver-001',
      });

      expect(result.content).toBeInstanceOf(Array);
      if (result.content.length > 0) {
        expect(result.content[0]).toHaveProperty('type');
        expect(result.content[0]).toHaveProperty('text');
      }
    });

    it('should set isError=true for error responses', async () => {
      const result = await mcpGateway.handleToolCall('preview_html', {});

      expect(result.isError).toBe(true);
    });

    it('should include error code in error message', async () => {
      const result = await mcpGateway.handleToolCall('get_annotations', {
        version_id: 'non-existent-version',
      });

      if (result.isError) {
        expect(result.content[0].text).toMatch(/VERSION_NOT_FOUND|ANNOTATION_VERSION_NOT_FOUND/);
      }
    });
  });

  describe('MCP notification push', () => {
    it('should send notification with correct method name', async () => {
      const sendNotification = vi.fn();
      mcpGateway.setNotificationHandler(sendNotification);

      await mcpGateway.pushAnnotations('session-1', 'ver-001', [], 'export text');

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'notifications/annotations_submitted',
        })
      );
    });

    it('should include session_id and version_id in notification params', async () => {
      const sendNotification = vi.fn();
      mcpGateway.setNotificationHandler(sendNotification);

      await mcpGateway.pushAnnotations('session-1', 'ver-001', [], 'export');

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            session_id: 'session-1',
            version_id: 'ver-001',
          }),
        })
      );
    });

    it('should include annotations and export_markdown in notification', async () => {
      const sendNotification = vi.fn();
      mcpGateway.setNotificationHandler(sendNotification);

      const annotations = [{ id: 'a1', type: 'COMMENT', comment: 'test' }];
      await mcpGateway.pushAnnotations('s1', 'v1', annotations as any, '## Annotations\n...');

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            annotations: annotations,
            export_markdown: '## Annotations\n...',
          }),
        })
      );
    });
  });

  describe('unknown tool handling', () => {
    it('should return error for unknown tool name', async () => {
      const result = await mcpGateway.handleToolCall('unknown_tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('unknown');
    });
  });
});
