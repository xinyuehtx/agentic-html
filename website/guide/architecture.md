# Architecture

Agentic HTML follows a **Core Service + dual-gateway** design: one place for all
business logic, two thin ways to expose it.

```
┌─────────────────────────────────────────────────────────────┐
│  Gateway Layer (isomorphic capabilities, different exposure) │
│  ┌─────────────────────┬─────────────────────┐              │
│  │   MCP Gateway        │   CLI Gateway        │              │
│  │  · stdio transport   │  · command-line args │              │
│  │  · real-time push    │  · file-system I/O   │              │
│  └──────────┬──────────┴──────────┬──────────┘              │
│             └──────────┬──────────┘                          │
├────────────────────────┼────────────────────────────────────┤
│  Core Service Layer     ▼                                     │
│  · PreviewService    — HTML rendering & hot reload           │
│  · AnnotationService — annotation CRUD & export              │
│  · VersionService    — create / checkout / compare / graph   │
│  · PatchService      — DOM targeting & diff application      │
│  · SnapshotService   — DOM snapshot & hit-test              │
├─────────────────────────────────────────────────────────────┤
│  UI Layer (browser)                                          │
│  · Overlay · Ink Canvas · Element Capture · Sidebar · Graph  │
└─────────────────────────────────────────────────────────────┘
```

## Core Service layer

The single source of business logic. Nothing here knows whether it was called
from MCP or the CLI.

| Service | Responsibility |
|---------|----------------|
| `PreviewService` | Start/stop preview sessions, hot reload over WebSocket |
| `AnnotationService` | Create, list, update, delete, submit, export annotations |
| `VersionService` | Tree-numbered versions; create, seal, checkout, compare, history |
| `PatchService` | Apply selector-based patches (via cheerio), compute diffs |
| `SnapshotService` | DOM snapshots and grid-sampled hit-testing |

## Gateway layer

The gateways are thin: parse input → call a Core Service method → format output.
Every capability is mirrored across both.

| Core method | MCP tool | CLI command |
|-------------|----------|-------------|
| `previewService.start` | `preview_html` | `html-editor preview <file>` |
| `annotationService.getAll` | `get_annotations` | `html-editor annotations list` |
| `patchService.apply` | `apply_patch` | `html-editor patch apply <file>` |
| `snapshotService.get` | `get_dom_snapshot` | `html-editor snapshot <selector>` |
| `versionService.history` | `get_version_history` | `html-editor versions list` |
| `versionService.checkout` | `checkout_version` | `html-editor versions checkout <v>` |
| `versionService.compare` | `compare_versions` | `html-editor versions diff <a> <b>` |

## UI layer

A React app rendered over the preview:

- **Overlay** — a transparent layer whose pointer behavior changes per mode
  (ink captures strokes; select lets clicks reach the iframe).
- **Ink Canvas** — SVG freehand capture → hit-test → screenshot.
- **Element Capture** — hover highlight → click → capture → compose ("add to chat").
- **Annotation Store** — a client-side source of truth unifying ink + element
  captures, with best-effort backend sync.
- **Version Graph** — the version tree with diff and checkout.
- **Theme** — adaptive dark/light design-token system.

## Storage

State persists under the project directory:

```
.html-editor/
├── versions/
│   ├── index.json            # version tree index
│   └── <version-id>/
│       ├── snapshot.html
│       ├── meta.json
│       └── annotations.json
└── annotations/              # CLI-gateway export target
```
