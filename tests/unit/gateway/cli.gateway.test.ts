/**
 * CLI Gateway 单元测试
 * 覆盖：命令参数解析、stdout 输出格式、文件写入路径、错误 exit code
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliGateway } from '@/gateway/cli/index';
import { SAMPLE_HTML } from '../../setup';

describe('CLI Gateway', () => {
  let cliGateway: CliGateway;
  let mockStdout: string[];
  let mockStderr: string[];
  let exitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStdout = [];
    mockStderr = [];
    exitCode = undefined;

    cliGateway = new CliGateway({
      stdout: (text: string) => mockStdout.push(text),
      stderr: (text: string) => mockStderr.push(text),
      exit: (code: number) => { exitCode = code; },
    });
  });

  describe('html-editor preview <file>', () => {
    it('should parse file argument correctly', async () => {
      await cliGateway.execute(['preview', '/path/to/index.html']);

      expect(mockStdout.length).toBeGreaterThan(0);
      const output = JSON.parse(mockStdout[0]);
      expect(output.url).toBeDefined();
      expect(output.session_id).toBeDefined();
      expect(output.version_id).toBeDefined();
    });

    it('should parse --port option', async () => {
      await cliGateway.execute(['preview', '/path/to/index.html', '--port', '8080']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.url).toContain('8080');
    });

    it('should parse --no-open option', async () => {
      await cliGateway.execute(['preview', '/path/to/index.html', '--no-open']);

      // 不应自动打开浏览器，但预览仍然启动
      expect(mockStdout.length).toBeGreaterThan(0);
    });

    it('should parse --no-watch option', async () => {
      await cliGateway.execute(['preview', '/path/to/index.html', '--no-watch']);

      expect(mockStdout.length).toBeGreaterThan(0);
    });

    it('should output JSON format by default', async () => {
      await cliGateway.execute(['preview', '/path/to/index.html']);

      expect(() => JSON.parse(mockStdout[0])).not.toThrow();
    });

    it('should exit with code 1 when file not found', async () => {
      await cliGateway.execute(['preview', '/nonexistent/file.html']);

      expect(exitCode).toBe(1);
    });

    it('should exit with code 1 for invalid file format', async () => {
      await cliGateway.execute(['preview', '/path/to/file.txt']);

      expect(exitCode).toBe(1);
    });

    it('should exit with code 2 for port conflict', async () => {
      await cliGateway.execute(['preview', '/path/to/index.html', '--port', '1']);

      expect(exitCode).toBe(2);
    });
  });

  describe('html-editor annotations list', () => {
    it('should parse --version option', async () => {
      await cliGateway.execute(['annotations', 'list', '--version', 'ver-001']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.annotations).toBeInstanceOf(Array);
      expect(output.count).toBeDefined();
    });

    it('should parse --status filter option', async () => {
      await cliGateway.execute(['annotations', 'list', '--version', 'ver-001', '--status', 'pending']);

      expect(mockStdout.length).toBeGreaterThan(0);
    });

    it('should parse --type filter option', async () => {
      await cliGateway.execute(['annotations', 'list', '--version', 'ver-001', '--type', 'COMMENT']);

      expect(mockStdout.length).toBeGreaterThan(0);
    });

    it('should require --version option', async () => {
      await cliGateway.execute(['annotations', 'list']);

      expect(exitCode).toBe(1);
      expect(mockStderr.length).toBeGreaterThan(0);
    });
  });

  describe('html-editor annotations export', () => {
    it('should parse --version and --out options', async () => {
      const fs = await import('fs/promises');

      await cliGateway.execute([
        'annotations', 'export',
        '--version', 'ver-001',
        '--out', '/output/annotations.json',
      ]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/output/annotations.json',
        expect.any(String)
      );
    });

    it('should output to stdout when --out is not specified', async () => {
      await cliGateway.execute(['annotations', 'export', '--version', 'ver-001']);

      expect(mockStdout.length).toBeGreaterThan(0);
    });

    it('should support --format-export md option', async () => {
      await cliGateway.execute([
        'annotations', 'export',
        '--version', 'ver-001',
        '--format-export', 'md',
      ]);

      expect(mockStdout[0]).toContain('标注');
    });

    it('should support --no-screenshots option', async () => {
      await cliGateway.execute([
        'annotations', 'export',
        '--version', 'ver-001',
        '--no-screenshots',
      ]);

      expect(mockStdout[0]).not.toContain('base64');
    });
  });

  describe('html-editor patch apply <file>', () => {
    it('should parse patch file argument', async () => {
      const fs = await import('fs/promises');
      const patchData = JSON.stringify([{
        annotation_id: 'ann-1',
        selector: 'h1',
        action: 'replace',
        content: '<h1>New</h1>',
      }]);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(patchData);

      await cliGateway.execute(['patch', 'apply', '/path/to/patches.json', '--version', 'ver-001']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.new_version_id).toBeDefined();
      expect(output.applied).toBeDefined();
    });

    it('should parse --version option', async () => {
      const fs = await import('fs/promises');
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('[]');

      await cliGateway.execute(['patch', 'apply', '/patches.json', '--version', 'ver-002']);

      expect(mockStdout.length).toBeGreaterThan(0);
    });

    it('should parse --dry-run option', async () => {
      const fs = await import('fs/promises');
      const patchData = JSON.stringify([{
        annotation_id: 'ann-1',
        selector: 'h1',
        action: 'replace',
        content: '<h1>New</h1>',
      }]);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(patchData);

      await cliGateway.execute(['patch', 'apply', '/patches.json', '--version', 'ver-001', '--dry-run']);

      // dry-run 不应创建新版本
      const output = JSON.parse(mockStdout[0]);
      expect(output.diff).toBeDefined();
    });

    it('should output JSON with new_version_id, diff, applied, failed', async () => {
      const fs = await import('fs/promises');
      const patchData = JSON.stringify([{
        annotation_id: 'ann-1',
        selector: 'body > div.hero > h1',
        action: 'replace',
        content: '<h1>New</h1>',
      }]);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(patchData);

      await cliGateway.execute(['patch', 'apply', '/patches.json', '--version', 'ver-001']);

      const output = JSON.parse(mockStdout[0]);
      expect(output).toHaveProperty('new_version_id');
      expect(output).toHaveProperty('diff');
      expect(output).toHaveProperty('applied');
      expect(output).toHaveProperty('failed');
    });
  });

  describe('html-editor snapshot <selector>', () => {
    it('should parse optional selector argument', async () => {
      await cliGateway.execute(['snapshot', '--version', 'ver-001']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.html).toBeDefined();
      expect(output.tree).toBeDefined();
    });

    it('should parse selector argument', async () => {
      await cliGateway.execute(['snapshot', 'div.hero', '--version', 'ver-001']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.html).toBeDefined();
    });

    it('should parse --version option', async () => {
      await cliGateway.execute(['snapshot', '--version', 'ver-002']);

      expect(mockStdout.length).toBeGreaterThan(0);
    });

    it('should support --tree-only option', async () => {
      await cliGateway.execute(['snapshot', '--version', 'ver-001', '--tree-only']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.tree).toBeDefined();
    });
  });

  describe('html-editor versions list', () => {
    it('should parse --session option', async () => {
      await cliGateway.execute(['versions', 'list', '--session', 'session-1']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.versions).toBeInstanceOf(Array);
    });

    it('should require --session option', async () => {
      await cliGateway.execute(['versions', 'list']);

      expect(exitCode).toBe(1);
    });

    it('should support --graph option', async () => {
      await cliGateway.execute(['versions', 'list', '--session', 'session-1', '--graph']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.graph).toBeDefined();
    });
  });

  describe('html-editor versions checkout <version-id>', () => {
    it('should parse version-id argument', async () => {
      await cliGateway.execute(['versions', 'checkout', 'ver-001']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.working_version_id).toBeDefined();
    });

    it('should parse --keep-annotations option', async () => {
      await cliGateway.execute(['versions', 'checkout', 'ver-001', '--keep-annotations']);

      expect(mockStdout.length).toBeGreaterThan(0);
    });

    it('should exit with code 1 for invalid version-id', async () => {
      await cliGateway.execute(['versions', 'checkout', 'non-existent-version']);

      expect(exitCode).toBe(1);
    });
  });

  describe('html-editor versions create', () => {
    it('should parse --parent option', async () => {
      const fs = await import('fs/promises');
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      await cliGateway.execute(['versions', 'create', '--parent', 'ver-001', '--html', '/path.html']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.version_id).toBeDefined();
    });

    it('should require --parent option', async () => {
      await cliGateway.execute(['versions', 'create', '--html', '/path.html']);

      expect(exitCode).toBe(1);
    });

    it('should support --inherit-annotations option', async () => {
      const fs = await import('fs/promises');
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      await cliGateway.execute([
        'versions', 'create',
        '--parent', 'ver-001',
        '--html', '/path.html',
        '--inherit-annotations',
      ]);

      expect(mockStdout.length).toBeGreaterThan(0);
    });
  });

  describe('html-editor versions diff <v1> <v2>', () => {
    it('should parse version arguments', async () => {
      await cliGateway.execute(['versions', 'diff', 'ver-001', 'ver-002']);

      const output = JSON.parse(mockStdout[0]);
      expect(output.diff).toBeDefined();
      expect(output.additions).toBeDefined();
      expect(output.deletions).toBeDefined();
    });

    it('should output unified diff in text format', async () => {
      await cliGateway.execute(['versions', 'diff', 'ver-001', 'ver-002', '--format', 'text']);

      // text 格式应输出 unified diff
      expect(mockStdout[0]).toContain('---');
    });

    it('should exit with code 1 for invalid version args', async () => {
      await cliGateway.execute(['versions', 'diff', 'invalid-v1', 'invalid-v2']);

      expect(exitCode).toBe(1);
    });
  });

  describe('global options', () => {
    it('should support --format json globally', async () => {
      await cliGateway.execute(['--format', 'json', 'annotations', 'list', '--version', 'ver-001']);

      expect(() => JSON.parse(mockStdout[0])).not.toThrow();
    });

    it('should support --format text globally', async () => {
      await cliGateway.execute(['--format', 'text', 'annotations', 'list', '--version', 'ver-001']);

      // text 格式不应是 JSON
      expect(mockStdout.length).toBeGreaterThan(0);
    });

    it('should support --quiet option', async () => {
      await cliGateway.execute(['--quiet', 'preview', '/path/to/index.html']);

      // quiet 模式只输出结果，无额外日志
      expect(mockStderr).toHaveLength(0);
    });
  });

  describe('error exit codes', () => {
    it('should exit 0 on success', async () => {
      const fs = await import('fs/promises');
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      await cliGateway.execute(['preview', '/path/to/index.html']);

      expect(exitCode).toBeUndefined(); // 成功时不调用 exit，或 exit(0)
    });

    it('should exit 1 on general error', async () => {
      await cliGateway.execute(['annotations', 'list']); // 缺少 --version

      expect(exitCode).toBe(1);
    });

    it('should output error message to stderr', async () => {
      await cliGateway.execute(['preview', '/nonexistent.html']);

      expect(mockStderr.length).toBeGreaterThan(0);
    });
  });

  describe('file write paths', () => {
    it('should write annotations to correct path pattern', async () => {
      const fs = await import('fs/promises');

      await cliGateway.execute([
        'annotations', 'export',
        '--version', 'ver-001',
        '--out', '.html-editor/annotations/ver-001.json',
      ]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        '.html-editor/annotations/ver-001.json',
        expect.any(String)
      );
    });

    it('should write version snapshots to .html-editor/versions/ directory', async () => {
      const fs = await import('fs/promises');
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_HTML);

      await cliGateway.execute(['versions', 'create', '--parent', 'ver-001', '--html', '/p.html']);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.html-editor/versions/'),
        expect.any(String)
      );
    });
  });
});
