/**
 * PreviewService - manages live preview sessions for HTML files.
 * Provides start, stop, refresh, getSession, and listSessions operations.
 */

import { PreviewSession, PreviewOptions } from './types.js';
import { HtmlEditorError, ErrorCodes } from './errors.js';
import { VersionService } from './version.service.js';
import express from 'express';
import { WebSocketServer } from 'ws';
import { watch } from 'chokidar';
import { readFile, access, stat } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_EXTENSIONS = ['.html', '.htm'];

interface InternalSession {
  session: PreviewSession;
  server: any;
  wss: any;
  watcher?: any;
}

export class PreviewService {
  private sessions: Map<string, InternalSession> = new Map();
  private usedPorts: Set<number> = new Set();
  private versionService: VersionService;
  private sessionCounter = 0;

  constructor(versionService?: VersionService) {
    this.versionService = versionService || new VersionService();
  }

  /**
   * Generate a unique session ID using uuid + counter.
   */
  private generateSessionId(): string {
    return `${uuidv4()}-${this.sessionCounter++}`;
  }

  /**
   * Start a preview session for a given HTML file.
   */
  async start(filePath: string, options?: PreviewOptions): Promise<PreviewSession> {
    // 1. File existence check
    try {
      await access(filePath);
    } catch {
      throw new HtmlEditorError(
        ErrorCodes.PREVIEW_FILE_NOT_FOUND,
        `File not found: ${filePath}`,
        'preview'
      );
    }

    // 2. Extension check
    const ext = extname(filePath).toLowerCase();
    if (!VALID_EXTENSIONS.includes(ext)) {
      throw new HtmlEditorError(
        ErrorCodes.PREVIEW_INVALID_FORMAT,
        `Invalid file format: ${ext}. Only .html and .htm are supported`,
        'preview'
      );
    }

    // 3. File size check
    const stats = await stat(filePath);
    if ((stats as any).size >= MAX_FILE_SIZE) {
      throw new HtmlEditorError(
        ErrorCodes.PREVIEW_FILE_TOO_LARGE,
        `File too large. Maximum is ${MAX_FILE_SIZE} bytes`,
        'preview'
      );
    }

    // 4. Port allocation check
    const requestedPort = options?.port ?? 0;
    if (requestedPort !== 0 && this.usedPorts.has(requestedPort)) {
      throw new HtmlEditorError(
        ErrorCodes.PREVIEW_PORT_CONFLICT,
        `Port ${requestedPort} is already in use`,
        'preview'
      );
    }

    // 5. Read HTML file content
    const htmlContent = await readFile(filePath, 'utf-8');

    // 6. Create initial version (v1)
    const version = await this.versionService.create({
      htmlContent,
      parentId: null,
    });

    // 7. Start Express HTTP server
    const app = express();

    app.get('/preview', (_req: any, res: any) => {
      res.type('html').send(this.getPreviewShell(version.id));
    });

    app.get('/api/snapshot/:versionId', async (req: any, res: any) => {
      const v = await this.versionService.get(req.params.versionId);
      if (v) {
        res.type('html').send(v.htmlContent);
      } else {
        res.status(404).json({ error: 'Version not found' });
      }
    });

    const { server, actualPort } = await this.listenOnPort(app, requestedPort);

    // 8. Start WebSocket server
    const wss = new WebSocketServer({ server });

    // 9. File watching (if watch !== false)
    let watcher: any = undefined;
    if (options?.watch !== false) {
      watcher = watch(filePath);
      watcher.on('change', () => {
        this.broadcastReload(wss);
      });
    }

    // 10. Create and store session
    const sessionId = this.generateSessionId();
    const hasErrors = this.detectHtmlErrors(htmlContent);
    const session: PreviewSession = {
      sessionId,
      url: `http://localhost:${actualPort}/preview`,
      port: actualPort,
      filePath,
      versionId: version.id,
      createdAt: new Date().toISOString(),
      hasErrors,
    };

    this.sessions.set(sessionId, { session, server, wss, watcher });
    this.usedPorts.add(actualPort);

    return session;
  }

  /**
   * Stop a preview session.
   */
  async stop(sessionId: string): Promise<void> {
    const internal = this.sessions.get(sessionId);
    if (!internal) {
      throw new HtmlEditorError(
        ErrorCodes.PREVIEW_SESSION_NOT_FOUND,
        `Session '${sessionId}' not found`,
        'preview'
      );
    }

    // Close file watcher
    if (internal.watcher) {
      internal.watcher.close();
    }

    // Close WebSocket server
    internal.wss.close();

    // Close HTTP server
    await new Promise<void>((resolve) => {
      internal.server.close(() => resolve());
    });

    // Release port and remove session
    this.usedPorts.delete(internal.session.port);
    this.sessions.delete(sessionId);
  }

  /**
   * Refresh a preview session - re-read HTML and push reload to clients.
   */
  async refresh(sessionId: string): Promise<void> {
    const internal = this.sessions.get(sessionId);
    if (!internal) {
      throw new HtmlEditorError(
        ErrorCodes.PREVIEW_SESSION_NOT_FOUND,
        `Session '${sessionId}' not found`,
        'preview'
      );
    }

    // Re-read the HTML file
    await readFile(internal.session.filePath, 'utf-8');

    // Broadcast reload to all connected WebSocket clients
    this.broadcastReload(internal.wss);
  }

  /**
   * Get session info by ID.
   */
  getSession(sessionId: string): PreviewSession | null {
    const internal = this.sessions.get(sessionId);
    return internal ? internal.session : null;
  }

  /**
   * List all active preview sessions.
   */
  listSessions(): PreviewSession[] {
    return Array.from(this.sessions.values()).map((s) => s.session);
  }

  /**
   * Broadcast reload message to all WebSocket clients.
   */
  private broadcastReload(wss: any): void {
    const message = JSON.stringify({ type: 'reload' });
    if (wss.clients) {
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    }
  }

  /**
   * Generate the preview shell HTML page.
   */
  private getPreviewShell(versionId: string): string {
    return `<!DOCTYPE html>
<html>
<head><title>Preview</title></head>
<body>
  <iframe id="preview-frame" src="/api/snapshot/${versionId}" style="width:100%;height:100vh;border:none;"></iframe>
  <script>
    const ws = new WebSocket('ws://' + location.host);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'reload') {
        document.getElementById('preview-frame').src = '/api/snapshot/${versionId}?' + Date.now();
      }
    };
  </script>
</body>
</html>`;
  }

  /**
   * Listen on a port, returning the server and actual port.
   */
  private listenOnPort(app: any, port: number): Promise<{ server: any; actualPort: number }> {
    return new Promise((resolve, reject) => {
      const server = app.listen(port, () => {
        const addr = server.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : port;
        resolve({ server, actualPort });
      });
      server.on('error', (err: any) => {
        reject(
          new HtmlEditorError(
            ErrorCodes.PREVIEW_PORT_CONFLICT,
            `Port ${port} is already in use: ${err.message}`,
            'preview'
          )
        );
      });
    });
  }

  /**
   * Detect basic HTML parse errors by checking for missing closing tags.
   */
  private detectHtmlErrors(html: string): boolean {
    // Check if HTML has non-void open tags but no closing tags at all
    const hasOpenTags = /<(div|span|body|html|p|h[1-6]|section|article|main|header|footer|nav|aside|ul|ol|li|table|tr|td|th|form|a|button)[\s>]/i.test(html);
    const hasCloseTags = /<\/(div|span|body|html|p|h[1-6]|section|article|main|header|footer|nav|aside|ul|ol|li|table|tr|td|th|form|a|button)>/i.test(html);

    if (hasOpenTags && !hasCloseTags) return true;

    return false;
  }
}
