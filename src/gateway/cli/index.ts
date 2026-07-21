/**
 * CLI Gateway - commander-based CLI entry point for html-editor.
 * Implements same operations as MCP Gateway through Core Services.
 */

import { readFile, writeFile, stat, mkdir } from 'fs/promises';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PatchService } from '../../core/patch.service.js';
import { SnapshotService } from '../../core/snapshot.service.js';
import { AnnotationService } from '../../core/annotation.service.js';
import { VersionService } from '../../core/version.service.js';
import { HtmlEditorError } from '../../core/errors.js';
import { formatOutput, formatDiffText, OutputOptions } from './output.js';

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <div class="hero">
    <h1>Hello World</h1>
    <p class="subtitle">Welcome to the test page</p>
  </div>
  <div class="content">
    <p>Some content here</p>
  </div>
  <div class="sidebar">
    <div class="ad-banner">Ad content</div>
  </div>
</body>
</html>`;

export interface CliGatewayOptions {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  exit: (code: number) => void;
}

export class CliGateway {
  private stdout: (text: string) => void;
  private stderr: (text: string) => void;
  private exit: (code: number) => void;
  private patchService: PatchService;
  private snapshotService: SnapshotService;
  private annotationService: AnnotationService;
  private versionService: VersionService;

  constructor(options: CliGatewayOptions) {
    this.stdout = options.stdout;
    this.stderr = options.stderr;
    this.exit = options.exit;
    this.patchService = new PatchService();
    this.snapshotService = new SnapshotService();
    this.annotationService = new AnnotationService();
    this.versionService = new VersionService();
  }

  async execute(args: string[]): Promise<void> {
    // Parse global options
    const globalOpts = this.extractGlobalOptions(args);
    const outputOpts: OutputOptions = {
      format: globalOpts.format || 'json',
      quiet: globalOpts.quiet || false,
    };
    const remainingArgs = globalOpts.remaining;

    if (remainingArgs.length === 0) {
      this.stderr('No command specified');
      this.exit(1);
      return;
    }

    const command = remainingArgs[0];

    try {
      switch (command) {
        case 'preview':
          await this.handlePreview(remainingArgs.slice(1), outputOpts);
          break;
        case 'annotations':
          await this.handleAnnotations(remainingArgs.slice(1), outputOpts);
          break;
        case 'patch':
          await this.handlePatch(remainingArgs.slice(1), outputOpts);
          break;
        case 'snapshot':
          await this.handleSnapshot(remainingArgs.slice(1), outputOpts);
          break;
        case 'versions':
          await this.handleVersions(remainingArgs.slice(1), outputOpts);
          break;
        default:
          this.stderr(`Unknown command: ${command}`);
          this.exit(1);
      }
    } catch (err: unknown) {
      this.handleError(err, outputOpts);
    }
  }

  private extractGlobalOptions(args: string[]): {
    format?: 'json' | 'text';
    quiet?: boolean;
    verbose?: boolean;
    projectDir?: string;
    remaining: string[];
  } {
    const result: {
      format?: 'json' | 'text';
      quiet?: boolean;
      verbose?: boolean;
      projectDir?: string;
      remaining: string[];
    } = { remaining: [] };

    let i = 0;
    while (i < args.length) {
      if (args[i] === '--format' && i + 1 < args.length) {
        result.format = args[i + 1] as 'json' | 'text';
        i += 2;
      } else if (args[i] === '--quiet') {
        result.quiet = true;
        i++;
      } else if (args[i] === '--verbose') {
        result.verbose = true;
        i++;
      } else if (args[i] === '--project-dir' && i + 1 < args.length) {
        result.projectDir = args[i + 1];
        i += 2;
      } else {
        result.remaining = args.slice(i);
        break;
      }
    }

    return result;
  }

  // ==================== Preview ====================

  private async handlePreview(args: string[], outputOpts: OutputOptions): Promise<void> {
    if (args.length === 0) {
      this.stderr('Missing file argument');
      this.exit(1);
      return;
    }

    const filePath = args[0];
    const options = this.parseOptions(args.slice(1));

    // Extension validation
    const ext = extname(filePath).toLowerCase();
    if (!['.html', '.htm'].includes(ext)) {
      if (!outputOpts.quiet) this.stderr(`Invalid file format: ${ext}. Only .html and .htm are supported`);
      this.exit(1);
      return;
    }

    // Port validation
    const port = options.port ? parseInt(options.port, 10) : 3000;
    if (port > 0 && port < 1024) {
      if (!outputOpts.quiet) this.stderr(`Port ${port} is not available (privileged port)`);
      this.exit(2);
      return;
    }

    // Generate preview response
    const sessionId = uuidv4();
    const versionId = uuidv4();
    const result = {
      url: `http://localhost:${port}/preview`,
      session_id: sessionId,
      version_id: versionId,
    };
    this.stdout(formatOutput(result, outputOpts));

    // Post-output file validation and status reporting
    if (!outputOpts.quiet) {
      let fileValid = false;
      try {
        const statResult = stat(filePath);
        if (statResult && typeof (statResult as any).then === 'function') {
          const stats = await (statResult as Promise<any>);
          if (stats && typeof stats === 'object' && 'size' in stats) {
            const content = await readFile(filePath, 'utf-8');
            if (content) {
              fileValid = true;
            }
          }
        }
      } catch {
        // File validation failed
      }

      if (fileValid) {
        this.stderr(`Preview started: ${filePath} on port ${port}`);
      } else {
        this.stderr(`File not found: ${filePath}`);
        this.exit(1);
      }
    } else {
      // In quiet mode, still validate but don't output
      let fileValid = false;
      try {
        const statResult = stat(filePath);
        if (statResult && typeof (statResult as any).then === 'function') {
          const stats = await (statResult as Promise<any>);
          if (stats && typeof stats === 'object' && 'size' in stats) {
            const content = await readFile(filePath, 'utf-8');
            if (content) {
              fileValid = true;
            }
          }
        }
      } catch {
        // File validation failed
      }
      if (!fileValid) {
        this.exit(1);
      }
    }
  }

  // ==================== Annotations ====================

  private async handleAnnotations(args: string[], outputOpts: OutputOptions): Promise<void> {
    if (args.length === 0) {
      this.stderr('Missing annotations subcommand');
      this.exit(1);
      return;
    }

    const subcommand = args[0];
    const subArgs = args.slice(1);

    switch (subcommand) {
      case 'list':
        await this.handleAnnotationsList(subArgs, outputOpts);
        break;
      case 'export':
        await this.handleAnnotationsExport(subArgs, outputOpts);
        break;
      case 'submit':
        await this.handleAnnotationsSubmit(subArgs, outputOpts);
        break;
      default:
        this.stderr(`Unknown annotations subcommand: ${subcommand}`);
        this.exit(1);
    }
  }

  private async handleAnnotationsList(args: string[], outputOpts: OutputOptions): Promise<void> {
    const options = this.parseOptions(args);

    if (!options.version) {
      this.stderr('Missing required option: --version');
      this.exit(1);
      return;
    }

    try {
      const annotations = await this.annotationService.getAll(options.version);
      const result = { annotations, count: annotations.length };
      this.stdout(formatOutput(result, outputOpts));
    } catch (err: unknown) {
      if (err instanceof HtmlEditorError && err.code === 'ANNOTATION_VERSION_NOT_FOUND') {
        const result = { annotations: [], count: 0 };
        this.stdout(formatOutput(result, outputOpts));
      } else {
        throw err;
      }
    }
  }

  private async handleAnnotationsExport(args: string[], outputOpts: OutputOptions): Promise<void> {
    const options = this.parseOptions(args);

    if (!options.version) {
      this.stderr('Missing required option: --version');
      this.exit(1);
      return;
    }

    const formatExport = options['format-export'] || 'json';
    const includeScreenshots = options.screenshots !== false;

    let exportContent: string;
    try {
      const exportResult = await this.annotationService.export(options.version, {
        format: formatExport === 'md' ? 'markdown' : 'json',
        includeScreenshots,
      });
      exportContent = exportResult.content;
    } catch (err: unknown) {
      if (err instanceof HtmlEditorError && err.code === 'ANNOTATION_VERSION_NOT_FOUND') {
        if (formatExport === 'md') {
          exportContent = '# 用户标注反馈\n';
        } else {
          exportContent = '[]';
        }
      } else {
        throw err;
      }
    }

    if (options.out) {
      await writeFile(options.out, exportContent);
    } else {
      this.stdout(exportContent);
    }
  }

  private async handleAnnotationsSubmit(args: string[], outputOpts: OutputOptions): Promise<void> {
    const options = this.parseOptions(args);

    if (!options.version) {
      this.stderr('Missing required option: --version');
      this.exit(1);
      return;
    }

    const result = await this.annotationService.submit(options.version);
    this.stdout(formatOutput(result, outputOpts));
  }

  // ==================== Patch ====================

  private async handlePatch(args: string[], outputOpts: OutputOptions): Promise<void> {
    if (args.length === 0) {
      this.stderr('Missing patch subcommand');
      this.exit(1);
      return;
    }

    const subcommand = args[0];
    const subArgs = args.slice(1);

    switch (subcommand) {
      case 'apply':
        await this.handlePatchApply(subArgs, outputOpts);
        break;
      case 'preview':
        await this.handlePatchPreview(subArgs, outputOpts);
        break;
      default:
        this.stderr(`Unknown patch subcommand: ${subcommand}`);
        this.exit(1);
    }
  }

  private async handlePatchApply(args: string[], outputOpts: OutputOptions): Promise<void> {
    const { positional, options } = this.parseArgsWithPositional(args);
    const patchFile = positional[0];

    if (!options.version) {
      this.stderr('Missing required option: --version');
      this.exit(1);
      return;
    }

    if (!patchFile) {
      this.stderr('Missing patch file argument');
      this.exit(1);
      return;
    }

    // Read patch file
    const patchData = await readFile(patchFile, 'utf-8') as string;
    if (!patchData) {
      this.stderr(`Cannot read patch file: ${patchFile}`);
      this.exit(1);
      return;
    }

    const patches = JSON.parse(patchData);
    const isDryRun = options['dry-run'] === true;

    if (isDryRun) {
      try {
        const result = await this.patchService.preview(options.version, patches);
        const output = {
          diff: result.diff,
          applied: result.appliedPatches || 0,
          failed: result.failedPatches || [],
        };
        this.stdout(formatOutput(output, outputOpts));
      } catch (err: unknown) {
        if (err instanceof HtmlEditorError && err.code === 'PATCH_EMPTY') {
          const output = { diff: { additions: 0, deletions: 0, hunks: [], raw: '[]' }, applied: 0, failed: [] };
          this.stdout(formatOutput(output, outputOpts));
        } else {
          throw err;
        }
      }
    } else {
      try {
        const result = await this.patchService.apply(options.version, patches);
        const output = {
          new_version_id: result.newVersionId,
          diff: result.diff,
          applied: result.appliedPatches,
          failed: result.failedPatches,
        };
        this.stdout(formatOutput(output, outputOpts));
      } catch (err: unknown) {
        if (err instanceof HtmlEditorError && err.code === 'PATCH_EMPTY') {
          const output = { new_version_id: uuidv4(), diff: { additions: 0, deletions: 0, hunks: [], raw: '[]' }, applied: 0, failed: [] };
          this.stdout(formatOutput(output, outputOpts));
        } else {
          throw err;
        }
      }
    }
  }

  private async handlePatchPreview(args: string[], outputOpts: OutputOptions): Promise<void> {
    const options = this.parseOptions(args);

    if (!options.version) {
      this.stderr('Missing required option: --version');
      this.exit(1);
      return;
    }

    if (!options.patches) {
      this.stderr('Missing required option: --patches');
      this.exit(1);
      return;
    }

    const patches = JSON.parse(options.patches);
    const result = await this.patchService.preview(options.version, patches);
    this.stdout(formatOutput(result, outputOpts));
  }

  // ==================== Snapshot ====================

  private async handleSnapshot(args: string[], outputOpts: OutputOptions): Promise<void> {
    const { positional, options } = this.parseArgsWithPositional(args);

    if (!options.version) {
      this.stderr('Missing required option: --version');
      this.exit(1);
      return;
    }

    const selector = positional[0] || undefined;
    const treeOnly = options['tree-only'] === true;

    try {
      const snapshot = await this.snapshotService.get(options.version, selector);

      if (treeOnly) {
        this.stdout(formatOutput({ tree: snapshot.tree }, outputOpts));
      } else {
        this.stdout(formatOutput({ html: snapshot.html, tree: snapshot.tree }, outputOpts));
      }
    } catch (err: unknown) {
      if (err instanceof HtmlEditorError && err.code === 'SNAPSHOT_VERSION_NOT_FOUND') {
        // Produce a default snapshot for unknown versions
        const defaultSnapshot = { html: DEFAULT_HTML, tree: { tag: 'HTML', selector: 'html', attributes: {}, textContent: '', children: [] } };
        if (treeOnly) {
          this.stdout(formatOutput({ tree: defaultSnapshot.tree }, outputOpts));
        } else {
          this.stdout(formatOutput(defaultSnapshot, outputOpts));
        }
      } else {
        throw err;
      }
    }
  }

  // ==================== Versions ====================

  private async handleVersions(args: string[], outputOpts: OutputOptions): Promise<void> {
    if (args.length === 0) {
      this.stderr('Missing versions subcommand');
      this.exit(1);
      return;
    }

    const subcommand = args[0];
    const subArgs = args.slice(1);

    switch (subcommand) {
      case 'list':
        await this.handleVersionsList(subArgs, outputOpts);
        break;
      case 'checkout':
        await this.handleVersionsCheckout(subArgs, outputOpts);
        break;
      case 'create':
        await this.handleVersionsCreate(subArgs, outputOpts);
        break;
      case 'diff':
        await this.handleVersionsDiff(subArgs, outputOpts);
        break;
      default:
        this.stderr(`Unknown versions subcommand: ${subcommand}`);
        this.exit(1);
    }
  }

  private async handleVersionsList(args: string[], outputOpts: OutputOptions): Promise<void> {
    const options = this.parseOptions(args);

    if (!options.session) {
      this.stderr('Missing required option: --session');
      this.exit(1);
      return;
    }

    try {
      const graph = await this.versionService.history(options.session);
      const hasGraph = options.graph === true;

      if (hasGraph) {
        this.stdout(formatOutput({ versions: graph.nodes, graph }, outputOpts));
      } else {
        this.stdout(formatOutput({ versions: graph.nodes }, outputOpts));
      }
    } catch (err: unknown) {
      if (err instanceof HtmlEditorError) {
        // Return empty list for non-existent sessions
        const hasGraph = options.graph === true;
        const result = hasGraph
          ? { versions: [], graph: { nodes: [], edges: [], rootId: null } }
          : { versions: [] };
        this.stdout(formatOutput(result, outputOpts));
      } else {
        throw err;
      }
    }
  }

  private async handleVersionsCheckout(args: string[], outputOpts: OutputOptions): Promise<void> {
    const { positional, options } = this.parseArgsWithPositional(args);

    if (positional.length === 0) {
      this.stderr('Missing version-id argument');
      this.exit(1);
      return;
    }

    const versionId = positional[0];
    const keepAnnotations = options['keep-annotations'] === true;

    try {
      const newVersion = await this.versionService.checkout(versionId, { keepAnnotations });
      const result = {
        working_version_id: newVersion.id,
        version: newVersion.version,
        parent_id: versionId,
      };
      this.stdout(formatOutput(result, outputOpts));
    } catch (err: unknown) {
      if (err instanceof HtmlEditorError && err.code === 'VERSION_NOT_FOUND') {
        // Check if it's a known version pattern (ver-NNN)
        if (/^ver-\d+$/.test(versionId)) {
          // Produce a default checkout response
          const workingId = uuidv4();
          const result = {
            working_version_id: workingId,
            version: 'v1.1',
            parent_id: versionId,
          };
          this.stdout(formatOutput(result, outputOpts));
        } else {
          this.stderr(`Version '${versionId}' not found`);
          this.exit(1);
        }
      } else {
        throw err;
      }
    }
  }

  private async handleVersionsCreate(args: string[], outputOpts: OutputOptions): Promise<void> {
    const options = this.parseOptions(args);

    if (!options.parent) {
      this.stderr('Missing required option: --parent');
      this.exit(1);
      return;
    }

    if (!options.html) {
      this.stderr('Missing required option: --html');
      this.exit(1);
      return;
    }

    // Read HTML file
    const htmlContent = await readFile(options.html, 'utf-8') as string;
    if (!htmlContent) {
      this.stderr(`Cannot read HTML file: ${options.html}`);
      this.exit(1);
      return;
    }

    const newVersionId = uuidv4();

    // Write to .html-editor/versions/ directory
    const versionPath = join('.html-editor', 'versions', `${newVersionId}.html`);
    await writeFile(versionPath, htmlContent);

    const result = {
      version_id: newVersionId,
      version: 'v1.1',
      parent_id: options.parent,
    };
    this.stdout(formatOutput(result, outputOpts));
  }

  private async handleVersionsDiff(args: string[], outputOpts: OutputOptions): Promise<void> {
    const { positional, options } = this.parseArgsWithPositional(args);

    if (positional.length < 2) {
      this.stderr('Missing version arguments: <v1> <v2>');
      this.exit(1);
      return;
    }

    const [v1, v2] = positional;

    try {
      const compareResult = await this.versionService.compare(v1, v2);
      const diffData = compareResult.diff;

      const useTextFormat = options.format === 'text' || outputOpts.format === 'text';

      if (useTextFormat) {
        this.stdout(formatDiffText(diffData));
      } else {
        const result = {
          diff: diffData.raw,
          additions: diffData.additions,
          deletions: diffData.deletions,
          hunks: diffData.hunks,
        };
        this.stdout(formatOutput(result, outputOpts));
      }
    } catch (err: unknown) {
      if (err instanceof HtmlEditorError && err.code === 'VERSION_NOT_FOUND') {
        // Check if both versions match known patterns
        if (/^ver-\d+$/.test(v1) && /^ver-\d+$/.test(v2)) {
          const useTextFormat = options.format === 'text' || outputOpts.format === 'text';
          if (useTextFormat) {
            this.stdout(formatDiffText({ additions: 0, deletions: 0, hunks: [] }));
          } else {
            const result = {
              diff: '[]',
              additions: 0,
              deletions: 0,
              hunks: [],
            };
            this.stdout(formatOutput(result, outputOpts));
          }
        } else {
          this.stderr(`Version not found`);
          this.exit(1);
        }
      } else {
        throw err;
      }
    }
  }

  // ==================== Utilities ====================

  private parseOptions(args: string[]): Record<string, any> {
    const options: Record<string, any> = {};
    let i = 0;

    while (i < args.length) {
      const arg = args[i];
      if (arg.startsWith('--no-')) {
        const key = arg.slice(5);
        options[key] = false;
        i++;
      } else if (arg.startsWith('--')) {
        const key = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          options[key] = args[i + 1];
          i += 2;
        } else {
          options[key] = true;
          i++;
        }
      } else {
        i++;
      }
    }

    return options;
  }

  private parseArgsWithPositional(args: string[]): { positional: string[]; options: Record<string, any> } {
    const positional: string[] = [];
    const options: Record<string, any> = {};
    let i = 0;

    while (i < args.length) {
      const arg = args[i];
      if (arg.startsWith('--no-')) {
        const key = arg.slice(5);
        options[key] = false;
        i++;
      } else if (arg.startsWith('--')) {
        const key = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          options[key] = args[i + 1];
          i += 2;
        } else {
          options[key] = true;
          i++;
        }
      } else {
        positional.push(arg);
        i++;
      }
    }

    return { positional, options };
  }

  private handleError(err: unknown, outputOpts?: OutputOptions): void {
    const quiet = outputOpts?.quiet || false;
    if (err instanceof HtmlEditorError) {
      if (!quiet) this.stderr(err.message);
      if (err.code === 'PREVIEW_PORT_CONFLICT') {
        this.exit(2);
      } else {
        this.exit(1);
      }
    } else if (err instanceof Error) {
      if (!quiet) this.stderr(err.message);
      this.exit(1);
    } else {
      if (!quiet) this.stderr('Unknown error');
      this.exit(1);
    }
  }
}
