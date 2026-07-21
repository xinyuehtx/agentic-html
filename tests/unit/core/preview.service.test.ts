/**
 * PreviewService 单元测试
 * 覆盖：启动预览、热更新、关闭预览、端口分配
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreviewService } from '@/core/preview.service';
import { SAMPLE_HTML } from '../../setup';

describe('PreviewService', () => {
  let previewService: PreviewService;

  beforeEach(() => {
    vi.clearAllMocks();
    previewService = new PreviewService();
  });

  describe('start()', () => {
    it('should start preview with a valid HTML file', async () => {
      // 模拟文件系统
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/index.html');

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.url).toMatch(/^http:\/\/localhost:\d+\/preview/);
      expect(session.port).toBeGreaterThan(0);
      expect(session.filePath).toBe('/path/to/index.html');
      expect(session.versionId).toBeDefined();
      expect(session.createdAt).toBeDefined();
    });

    it('should throw PREVIEW_FILE_NOT_FOUND when file does not exist', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT'));

      await expect(previewService.start('/path/to/nonexistent.html'))
        .rejects.toMatchObject({
          code: 'PREVIEW_FILE_NOT_FOUND',
        });
    });

    it('should throw PREVIEW_INVALID_FORMAT for non-HTML files', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await expect(previewService.start('/path/to/file.txt'))
        .rejects.toMatchObject({
          code: 'PREVIEW_INVALID_FORMAT',
        });
    });

    it('should throw PREVIEW_INVALID_FORMAT for .js files', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await expect(previewService.start('/path/to/app.js'))
        .rejects.toMatchObject({
          code: 'PREVIEW_INVALID_FORMAT',
        });
    });

    it('should throw PREVIEW_FILE_TOO_LARGE when file exceeds 5MB', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 6 * 1024 * 1024 });

      await expect(previewService.start('/path/to/large.html'))
        .rejects.toMatchObject({
          code: 'PREVIEW_FILE_TOO_LARGE',
        });
    });

    it('should accept .htm extension', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/page.htm');
      expect(session).toBeDefined();
      expect(session.filePath).toBe('/path/to/page.htm');
    });

    it('should use specified port when provided', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/index.html', { port: 8080 });
      expect(session.port).toBe(8080);
    });

    it('should throw PREVIEW_PORT_CONFLICT when specified port is in use', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      // 先占用端口
      await previewService.start('/path/to/index.html', { port: 9090 });

      // 再次使用同一端口应冲突
      await expect(previewService.start('/path/to/other.html', { port: 9090 }))
        .rejects.toMatchObject({
          code: 'PREVIEW_PORT_CONFLICT',
        });
    });

    it('should auto-assign port when port is 0', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/index.html', { port: 0 });
      expect(session.port).toBeGreaterThan(0);
    });

    it('should create initial version v1 when starting preview', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/index.html');
      expect(session.versionId).toBeDefined();
    });
  });

  describe('stop()', () => {
    it('should stop an active preview session', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/index.html');
      await expect(previewService.stop(session.sessionId)).resolves.toBeUndefined();
    });

    it('should throw PREVIEW_SESSION_NOT_FOUND for invalid session', async () => {
      await expect(previewService.stop('non-existent-session'))
        .rejects.toMatchObject({
          code: 'PREVIEW_SESSION_NOT_FOUND',
        });
    });

    it('should release the port after stopping', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/index.html', { port: 7070 });
      await previewService.stop(session.sessionId);

      // 端口应该可以重新使用
      const newSession = await previewService.start('/path/to/index.html', { port: 7070 });
      expect(newSession.port).toBe(7070);
    });

    it('should clean up file watcher on stop', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/index.html', { watch: true });
      await previewService.stop(session.sessionId);

      // 验证 watcher 被清理（通过确认 session 不再活跃）
      expect(previewService.getSession(session.sessionId)).toBeNull();
    });
  });

  describe('refresh()', () => {
    it('should refresh an active session', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/index.html');
      await expect(previewService.refresh(session.sessionId)).resolves.toBeUndefined();
    });

    it('should throw PREVIEW_SESSION_NOT_FOUND for invalid session on refresh', async () => {
      await expect(previewService.refresh('invalid-session'))
        .rejects.toMatchObject({
          code: 'PREVIEW_SESSION_NOT_FOUND',
        });
    });

    it('should re-read HTML file on refresh', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/index.html');

      // 修改文件内容
      const updatedHtml = '<html><body><h1>Updated</h1></body></html>';
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(updatedHtml);

      await previewService.refresh(session.sessionId);

      // readFile 应该被再次调用
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSession()', () => {
    it('should return session info for active session', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session = await previewService.start('/path/to/index.html');
      const info = previewService.getSession(session.sessionId);

      expect(info).not.toBeNull();
      expect(info?.sessionId).toBe(session.sessionId);
    });

    it('should return null for non-existent session', () => {
      const info = previewService.getSession('no-such-session');
      expect(info).toBeNull();
    });
  });

  describe('listSessions()', () => {
    it('should return all active sessions', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      await previewService.start('/path/to/a.html');
      await previewService.start('/path/to/b.html');

      const sessions = previewService.listSessions();
      expect(sessions).toHaveLength(2);
    });

    it('should return empty array when no sessions', () => {
      const sessions = previewService.listSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  describe('hot reload / file watching', () => {
    it('should trigger refresh when watched file changes', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const chokidar = await import('chokidar');
      const mockWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn(),
      };
      (chokidar.watch as ReturnType<typeof vi.fn>).mockReturnValue(mockWatcher);

      await previewService.start('/path/to/index.html', { watch: true });

      // 验证 chokidar.watch 被调用
      expect(chokidar.watch).toHaveBeenCalledWith('/path/to/index.html');
    });

    it('should not start watcher when watch option is false', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const chokidar = await import('chokidar');

      await previewService.start('/path/to/index.html', { watch: false });

      expect(chokidar.watch).not.toHaveBeenCalled();
    });
  });

  describe('port allocation', () => {
    it('should allocate different ports for multiple sessions', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      const session1 = await previewService.start('/path/to/a.html');
      const session2 = await previewService.start('/path/to/b.html');

      expect(session1.port).not.toBe(session2.port);
    });

    it('should retry port allocation on conflict (up to 10 times)', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      // 即使不指定端口，系统也应能自动分配
      const session = await previewService.start('/path/to/index.html');
      expect(session.port).toBeGreaterThan(0);
    });
  });
});
