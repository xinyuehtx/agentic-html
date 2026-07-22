# Usage

Agentic HTML works two ways: through the **MCP Gateway** (inside an agent) or the
**CLI Gateway** (standalone / scriptable). They are functionally equivalent.

## Install

```bash
npm install agentic-html
# or globally
npm install -g agentic-html
```

## CLI

```bash
# Start a live preview (creates version v1, opens the browser)
html-editor preview ./index.html

# List annotations for a version
html-editor annotations list --version <version_id>

# Export annotations (markdown or json)
html-editor annotations export --version <version_id> --out feedback.md

# Apply DOM patches, creating a new version
html-editor patch apply patches.json --version <version_id>

# Version history and diff
html-editor versions list --graph
html-editor versions diff <v1> <v2>
html-editor versions checkout <v> --keep-annotations
```

| Command | Description |
|---------|-------------|
| `preview <file>` | Start HTML live preview |
| `annotations list` | List annotations for a version |
| `annotations export` | Export annotations (`--format-export md\|json`) |
| `patch apply <file>` | Apply DOM patches (`--dry-run` to preview) |
| `snapshot [selector]` | Get a DOM snapshot |
| `versions list` | List version history (`--graph`) |
| `versions checkout <v>` | Checkout a version (`--keep-annotations`) |
| `versions diff <a> <b>` | Compare two versions |

## MCP

Add the server to your agent's `.mcp.json`:

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

Then just ask your agent to *"preview index.html"*. Available tools:

| Tool | Required params |
|------|-----------------|
| `preview_html` | `file_path` |
| `get_annotations` | `version_id` |
| `apply_patch` | `version_id`, `patches[]` |
| `get_dom_snapshot` | `version_id` |
| `get_version_history` | `session_id` |
| `checkout_version` | `version_id` |
| `create_version` | `parent_id`, `html_content` |
| `compare_versions` | `version_a`, `version_b` |
| `close_preview` | `session_id` |

## Configuration

Environment variables (override `.html-editor/config.json`, which overrides
defaults):

| Variable | Description | Default |
|----------|-------------|---------|
| `HTML_EDITOR_PORT` | Server port | `0` (auto) |
| `HTML_EDITOR_HOST` | Listen address | `localhost` |
| `HTML_EDITOR_MAX_FILE_SIZE` | Max file size (bytes) | `5242880` |
| `HTML_EDITOR_STORAGE_DIR` | Data directory | `.html-editor` |
| `ENABLE_INK_ANNOTATION` | Enable ink annotation | `true` |
| `ENABLE_VERSION_GRAPH` | Enable version graph UI | `true` |

## Develop this repo

```bash
npm install
npm run dev:ui      # UI dev server (port 5273), append ?demo=true for mock data
npm test            # unit + integration
npm run test:e2e    # Playwright E2E
npm run docs:dev    # this documentation site
```
