# agentic-html

[![npm version](https://img.shields.io/npm/v/agentic-html.svg)](https://www.npmjs.com/package/agentic-html)
[![test status](https://img.shields.io/github/actions/workflow/status/user/agentic-html/test.yml?label=tests)](https://github.com/user/agentic-html/actions)
[![license](https://img.shields.io/npm/l/agentic-html.svg)](./LICENSE)

English | [中文](./README.zh-CN.md)

> Agent Native HTML Editor Plugin — Preview, Annotate, Version, Patch

## Feature Highlights

- **HTML Live Preview** — iframe-based local preview with WebSocket hot reload
- **Ink Annotation** — Freehand drawing to circle regions, auto hit-test DOM elements
- **DOM Selection** — Click to select elements and add comments
- **Version Management** — Immutable version tree with branching, diff, and checkout
- **Dual Gateway Architecture** — MCP Gateway for Agent integration + CLI Gateway for standalone use
- **Cross-Agent Compatible** — Works with Claude Code, Codex CLI, Cursor, and any MCP client
- **Targeted Patching** — DOM-level precision patches instead of full HTML regeneration
- **Annotation Sidebar** — Visual list with scroll-to-element navigation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Gateway Layer (Isomorphic capabilities, different exposure) │
│  ┌─────────────────────┬─────────────────────┐              │
│  │   MCP Gateway        │   CLI Gateway        │              │
│  │  · stdio transport   │  · Command-line args  │              │
│  │  · Agent real-time   │  · Script / manual    │              │
│  │  · Bidirectional     │  · File system I/O    │              │
│  └──────────┬──────────┴──────────┬──────────┘              │
│             └──────────┬──────────┘                          │
│                        ▼                                     │
├─────────────────────────────────────────────────────────────┤
│  Core Service Layer (Business logic)                         │
│  · PreviewService    — HTML rendering & hot reload           │
│  · AnnotationService — Annotation CRUD & export              │
│  · VersionService    — Version create/checkout/compare/graph │
│  · PatchService      — DOM targeting & diff application      │
│  · SnapshotService   — DOM snapshot & hit-test               │
├─────────────────────────────────────────────────────────────┤
│  UI Layer (Browser)                                          │
│  · Annotation Overlay · Ink Canvas · Sidebar · Version Graph │
└─────────────────────────────────────────────────────────────┘
```

## Screenshots

<!-- screenshots will be auto-generated -->

![Preview](docs/screenshots/preview.png)
![Ink Annotation](docs/screenshots/annotation-ink.png)
![Annotation Sidebar](docs/screenshots/annotation-sidebar.png)
![Version Graph](docs/screenshots/version-graph.png)
![Version Diff](docs/screenshots/version-diff.png)
![HTML Error Feedback](docs/screenshots/html-error-feedback.png)

## Why agentic-html?

| Feature | agentic-html | Codex | Claude Code |
|---------|:---:|:---:|:---:|
| Explicit version tree (v1→v1.1→v1.1.1) | ✅ | ❌ | ❌ |
| Cross-agent compatibility (MCP) | ✅ | ❌ | ❌ |
| CLI toolchain | ✅ | ❌ | ❌ |
| Annotation-version binding | ✅ | ❌ | ❌ |
| Ink annotation + screenshot | ✅ | ✅ | ⚠️ |
| Open protocol & architecture | ✅ | ❌ | ❌ |
| Offline available | ✅ | ⚠️ | ⚠️ |
| Auto-verify loop | ⚠️ Planned | ✅ | ✅ |
| Zero config setup | ⚠️ | ✅ | ✅ |

**Core differentiators:**

1. **Version Tree Management** — Explicit tree-structured versioning with branching, rollback, and visual diff. Codex and Claude Code only offer implicit linear iteration with no version control over HTML states.
2. **Standard MCP Protocol** — Works with any MCP-compatible agent (Claude Code, Cursor, Codex CLI, custom agents). No vendor lock-in.
3. **CLI + Open Architecture** — Full command-line toolchain that can be scripted, piped, and integrated into CI/CD pipelines — not a closed feature buried inside a desktop app.

## Quick Start

### Installation

```bash
npm install agentic-html
```

Or install globally:

```bash
npm install -g agentic-html
```

### CLI Usage

```bash
# Start preview
html-editor preview ./index.html

# List annotations
html-editor annotations list --version <version_id>

# Apply patches
html-editor patch apply patches.json --version <version_id>
```

### MCP Configuration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "html-editor": {
      "command": "node",
      "args": ["./node_modules/agentic-html/dist/gateway/mcp/index.js"],
      "env": { "PORT": "0" }
    }
  }
}
```

## CLI Commands Reference

| Command | Description | Key Options |
|---------|-------------|-------------|
| `html-editor preview <file>` | Start HTML live preview | `--port`, `--no-open`, `--no-watch` |
| `html-editor annotations list` | List annotations for a version | `--version <id>` |
| `html-editor annotations export` | Export annotations | `--version <id>`, `--out <file>`, `--format-export <md\|json>` |
| `html-editor patch apply <file>` | Apply DOM patches | `--version <id>`, `--dry-run` |
| `html-editor snapshot [selector]` | Get DOM snapshot | `--version <id>`, `--tree-only` |
| `html-editor versions list` | List version history | `--session <id>`, `--graph` |
| `html-editor versions checkout <v>` | Checkout a version | `--keep-annotations` |
| `html-editor versions create` | Create new version | `--parent <id>`, `--html <path>` |
| `html-editor versions diff <v1> <v2>` | Compare two versions | `--format <json\|text>` |

**Global Options:** `--format <json|text>`, `--project-dir <path>`, `--quiet`, `--verbose`

## MCP Tools Reference

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `preview_html` | Start HTML preview, create initial version | `file_path` |
| `get_annotations` | Get annotations for a version | `version_id` |
| `apply_patch` | Apply DOM patches, create new version | `version_id`, `patches[]` |
| `get_dom_snapshot` | Get DOM tree snapshot | `version_id` |
| `get_version_history` | Get full version graph | `session_id` |
| `checkout_version` | Checkout version to working copy | `version_id` |
| `create_version` | Create version from parent | `parent_id`, `html_content` |
| `compare_versions` | Diff two versions | `version_a`, `version_b` |
| `close_preview` | Close preview session | `session_id` |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HTML_EDITOR_PORT` | Server port | `0` (auto) |
| `HTML_EDITOR_HOST` | Listen address | `localhost` |
| `HTML_EDITOR_NO_OPEN` | Disable auto browser open | unset |
| `HTML_EDITOR_MAX_FILE_SIZE` | Max file size in bytes | `5242880` (5MB) |
| `HTML_EDITOR_NO_WATCH` | Disable file watching | unset |
| `HTML_EDITOR_STORAGE_DIR` | Data storage directory | `.html-editor` |
| `HTML_EDITOR_MAX_VERSIONS` | Max versions per session | `200` |
| `ENABLE_INK_ANNOTATION` | Enable ink annotation | `true` |
| `ENABLE_VERSION_GRAPH` | Enable version graph UI | `true` |

### Config File

Configuration file location: `.html-editor/config.json`

```json
{
  "server": { "port": 0, "host": "localhost", "open_browser": true },
  "preview": { "watch": true, "max_file_size": 5242880 },
  "annotation": { "persist": true, "max_screenshot_size": 512000 },
  "version": { "max_versions": 200 },
  "features": {
    "enable_ink_annotation": true,
    "enable_version_graph": true,
    "enable_mcp_push": true
  }
}
```

**Priority:** Environment variables > config.json > defaults

## Examples

See the [examples/](./examples/) directory for complete workflow demonstrations.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Start UI dev server
npm run dev:ui

# Build UI
npm run build:ui
```

See [docs/development.md](./docs/development.md) for the full development guide.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the [development guide](./docs/development.md)
4. Ensure tests pass (`npm test`)
5. Commit your changes
6. Open a Pull Request

## License

[MIT](./LICENSE)
