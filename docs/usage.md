# 使用文档

本文档详细介绍 agentic-html 的安装、配置和完整使用方法。

---

## 目录

- [安装方式](#安装方式)
- [CLI 完整命令手册](#cli-完整命令手册)
- [MCP 工具完整说明](#mcp-工具完整说明)
- [配置参考](#配置参考)
- [常见工作流](#常见工作流)
- [错误码参考](#错误码参考)
- [FAQ](#faq)

---

## 安装方式

### npm 本地安装

```bash
npm install agentic-html
```

安装后可通过 `npx html-editor` 调用 CLI。

### 全局安装

```bash
npm install -g agentic-html
```

全局安装后可直接使用 `html-editor` 命令。

### MCP 配置（Agent 集成）

在项目根目录创建或编辑 `.mcp.json`：

```json
{
  "mcpServers": {
    "html-editor": {
      "command": "node",
      "args": ["./node_modules/agentic-html/dist/gateway/mcp/index.js"],
      "env": {
        "HTML_EDITOR_PORT": "0"
      }
    }
  }
}
```

支持的 Agent 客户端：
- Claude Code
- Codex CLI
- Cursor
- 所有兼容 MCP 协议的客户端

---

## CLI 完整命令手册

### 全局选项

所有命令均支持以下全局选项：

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--format <json\|text>` | 输出格式 | `json` |
| `--project-dir <path>` | 项目根目录 | 当前工作目录 |
| `--quiet` | 静默模式，仅输出结果 | 关闭 |
| `--verbose` | 详细日志 | 关闭 |

---

### `html-editor preview <file>`

启动 HTML 文件的本地预览服务。

**参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `file` | 是 | HTML 文件路径 |

**选项：**

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--port <number>` | 指定端口 | 自动分配 |
| `--no-open` | 不自动打开浏览器 | 自动打开 |
| `--no-watch` | 不监听文件变更 | 监听 |

**示例：**

```bash
# 启动预览（自动分配端口、自动打开浏览器）
html-editor preview ./index.html

# 指定端口、不自动打开浏览器
html-editor preview ./page.html --port 8080 --no-open

# 静默模式
html-editor --quiet preview ./index.html
```

**输出（JSON）：**

```json
{
  "url": "http://localhost:3000/preview",
  "session_id": "a1b2c3d4-...",
  "version_id": "v1-..."
}
```

**退出码：**
- `0` — 成功
- `1` — 文件不存在或格式错误
- `2` — 端口冲突

---

### `html-editor annotations list`

获取指定版本的标注列表。

**选项：**

| 选项 | 必填 | 说明 |
|------|------|------|
| `--version <id>` | 是 | 版本 ID |

**示例：**

```bash
html-editor annotations list --version ver-001
```

**输出（JSON）：**

```json
{
  "annotations": [
    {
      "id": "ann-001",
      "anchor_element": { "selector": "div.hero > h1" },
      "comment": "标题改小一点",
      "status": "pending",
      "timestamp": "2026-07-20T10:30:00Z",
      "version_id": "ver-001"
    }
  ],
  "count": 1
}
```

---

### `html-editor annotations export`

导出标注为 Markdown 或 JSON 格式。

**选项：**

| 选项 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `--version <id>` | 是 | 版本 ID | — |
| `--out <path>` | 否 | 输出文件路径（不指定则 stdout） | stdout |
| `--format-export <md\|json>` | 否 | 导出格式 | `json` |
| `--no-screenshots` | 否 | 不包含截图 base64 | 包含 |

**示例：**

```bash
# 导出为 Markdown 文件
html-editor annotations export --version ver-001 --format-export md --out feedback.md

# 导出 JSON 到 stdout
html-editor annotations export --version ver-001
```

---

### `html-editor patch apply <file>`

读取 patch JSON 文件并应用到指定版本。

**参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `file` | 是 | Patch JSON 文件路径 |

**选项：**

| 选项 | 必填 | 说明 |
|------|------|------|
| `--version <id>` | 是 | 基于哪个版本应用 |
| `--dry-run` | 否 | 仅预览，不持久化 |

**Patch 文件格式：**

```json
[
  {
    "annotation_id": "ann-001",
    "selector": "div.hero > h1",
    "action": "replace",
    "content": "<h1 class=\"title\" style=\"font-size:24px;color:#1a73e8\">Welcome</h1>",
    "old_content": "<h1 class=\"title\">Welcome to Our Site</h1>"
  }
]
```

**支持的 action：**
- `replace` — 替换元素内容/outerHTML
- `delete` — 移除元素
- `insert_before` — 在元素前插入
- `insert_after` — 在元素后插入
- `modify_style` — 修改 style 属性

**示例：**

```bash
# 应用补丁
html-editor patch apply ./patches.json --version ver-001

# 预览补丁效果（不实际应用）
html-editor patch apply ./patches.json --version ver-001 --dry-run
```

**输出（JSON）：**

```json
{
  "new_version_id": "ver-002",
  "diff": "...",
  "applied": 3,
  "failed": []
}
```

---

### `html-editor snapshot [selector]`

获取指定版本的 DOM 快照。

**参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `selector` | 否 | CSS 选择器（省略则整个文档） |

**选项：**

| 选项 | 必填 | 说明 |
|------|------|------|
| `--version <id>` | 是 | 版本 ID |
| `--tree-only` | 否 | 仅输出树结构，不含完整 HTML |

**示例：**

```bash
# 获取完整文档快照
html-editor snapshot --version ver-001

# 获取指定子树
html-editor snapshot "div.hero" --version ver-001 --tree-only
```

---

### `html-editor versions list`

查看会话的版本历史。

**选项：**

| 选项 | 必填 | 说明 |
|------|------|------|
| `--session <id>` | 是 | 会话 ID |
| `--graph` | 否 | 输出完整 Graph 结构 |

**示例：**

```bash
html-editor versions list --session sess-001 --graph
```

---

### `html-editor versions checkout <version-id>`

检出历史版本到 working copy。

**参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `version-id` | 是 | 目标版本 ID |

**选项：**

| 选项 | 说明 |
|------|------|
| `--keep-annotations` | 继承该版本的标注 |

**示例：**

```bash
# 检出版本（空白标注）
html-editor versions checkout ver-001

# 检出版本并继承标注
html-editor versions checkout ver-001 --keep-annotations
```

---

### `html-editor versions create`

基于父版本创建新版本。

**选项：**

| 选项 | 必填 | 说明 |
|------|------|------|
| `--parent <id>` | 是 | 父版本 ID |
| `--html <path>` | 是 | HTML 文件路径 |
| `--inherit-annotations` | 否 | 继承父版本标注 |

**示例：**

```bash
html-editor versions create --parent ver-001 --html ./modified.html
```

---

### `html-editor versions diff <v1> <v2>`

对比两个版本的 HTML 差异。

**参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `v1` | 是 | 版本 A 的 ID |
| `v2` | 是 | 版本 B 的 ID |

**示例：**

```bash
# JSON 格式输出
html-editor versions diff ver-001 ver-002

# unified diff 文本格式
html-editor versions diff ver-001 ver-002 --format text
```

---

## MCP 工具完整说明

### preview_html

启动 HTML 文件的本地预览，创建初始版本。

**inputSchema：**

```json
{
  "type": "object",
  "properties": {
    "file_path": { "type": "string", "description": "HTML 文件路径（绝对或相对路径）" },
    "port": { "type": "number", "description": "指定端口，默认自动分配" }
  },
  "required": ["file_path"]
}
```

**返回值：**

```json
{ "url": "http://localhost:3000/preview", "session_id": "...", "version_id": "..." }
```

---

### get_annotations

获取指定版本的标注数据。

**inputSchema：**

```json
{
  "type": "object",
  "properties": {
    "version_id": { "type": "string", "description": "版本 ID" }
  },
  "required": ["version_id"]
}
```

**返回值：**

```json
{ "annotations": [...], "version": "ver-001" }
```

---

### apply_patch

对指定版本应用 DOM patch，生成新版本。

**inputSchema：**

```json
{
  "type": "object",
  "properties": {
    "version_id": { "type": "string", "description": "基于哪个版本应用" },
    "patches": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "annotation_id": { "type": "string" },
          "selector": { "type": "string", "description": "CSS selector" },
          "action": { "type": "string", "enum": ["replace", "delete", "insert_before", "insert_after", "modify_style"] },
          "content": { "type": "string" },
          "old_content": { "type": "string" }
        },
        "required": ["annotation_id", "selector", "action"]
      }
    }
  },
  "required": ["version_id", "patches"]
}
```

**返回值：**

```json
{ "new_version_id": "...", "diff": "...", "applied_count": 3, "failed_patches": [] }
```

---

### get_dom_snapshot

获取指定版本的 DOM 快照。

**inputSchema：**

```json
{
  "type": "object",
  "properties": {
    "version_id": { "type": "string" },
    "selector": { "type": "string", "description": "可选，指定子树根节点" }
  },
  "required": ["version_id"]
}
```

**返回值：**

```json
{ "html": "<div>...</div>", "tree": { "tag": "DIV", "selector": "div.hero", ... } }
```

---

### get_version_history

获取会话的完整版本历史 Graph。

**inputSchema：**

```json
{
  "type": "object",
  "properties": {
    "session_id": { "type": "string" }
  },
  "required": ["session_id"]
}
```

**返回值：**

```json
{
  "versions": [{ "id": "...", "version": "v1", "timestamp": "...", ... }],
  "graph": { "nodes": [...], "edges": [...], "rootId": "...", "currentId": "..." }
}
```

---

### checkout_version

检出历史版本到 working copy。

**inputSchema：**

```json
{
  "type": "object",
  "properties": {
    "version_id": { "type": "string" },
    "keep_annotations": { "type": "boolean", "default": false }
  },
  "required": ["version_id"]
}
```

**返回值：**

```json
{ "working_version_id": "..." }
```

---

### create_version

基于父版本创建新版本。

**inputSchema：**

```json
{
  "type": "object",
  "properties": {
    "parent_id": { "type": "string" },
    "html_content": { "type": "string", "description": "新版本的完整 HTML" },
    "annotations": { "type": "array", "description": "可选继承的标注" }
  },
  "required": ["parent_id", "html_content"]
}
```

**返回值：**

```json
{ "version_id": "..." }
```

---

### compare_versions

对比两个版本的 HTML 差异和标注。

**inputSchema：**

```json
{
  "type": "object",
  "properties": {
    "version_a": { "type": "string" },
    "version_b": { "type": "string" }
  },
  "required": ["version_a", "version_b"]
}
```

**返回值：**

```json
{ "diff": "...", "annotations_a": [...], "annotations_b": [...] }
```

---

### close_preview

关闭预览会话。

**inputSchema：**

```json
{
  "type": "object",
  "properties": {
    "session_id": { "type": "string" }
  },
  "required": ["session_id"]
}
```

**返回值：**

```json
{ "success": true }
```

---

## 配置参考

### 配置文件

位置：`.html-editor/config.json`

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `server.port` | number | `0` | 服务端口（0 为自动分配） |
| `server.host` | string | `"localhost"` | 监听地址 |
| `server.open_browser` | boolean | `true` | 是否自动打开浏览器 |
| `preview.watch` | boolean | `true` | 是否监听文件变更 |
| `preview.max_file_size` | number | `5242880` | 最大文件大小（字节，5MB） |
| `preview.allowed_extensions` | string[] | `[".html", ".htm"]` | 允许预览的文件扩展名 |
| `annotation.persist` | boolean | `true` | 标注是否持久化到磁盘 |
| `annotation.max_screenshot_size` | number | `512000` | 截图最大大小（字节，500KB） |
| `annotation.screenshot_quality` | number | `0.8` | 截图压缩质量 |
| `annotation.screenshot_max_width` | number | `800` | 截图最大宽度 |
| `annotation.screenshot_max_height` | number | `600` | 截图最大高度 |
| `version.max_versions` | number | `200` | 单会话最大版本数 |
| `version.auto_cleanup` | boolean | `false` | 是否自动清理旧版本 |
| `ink.stroke_width` | number | `3` | 笔迹线宽（px） |
| `ink.stroke_color` | string | `"#FF4444"` | 笔迹颜色 |
| `ink.stroke_opacity` | number | `0.8` | 笔迹透明度 |
| `ink.max_points` | number | `2000` | 单次笔迹最大采样点 |
| `ink.max_duration` | number | `30000` | 单次笔迹最大持续时间（ms） |
| `hit_test.grid_step` | number | `10` | 采样网格步长（px） |
| `hit_test.threshold` | number | `0.3` | 交集面积阈值 |
| `features.enable_ink_annotation` | boolean | `true` | 启用笔迹圈画 |
| `features.enable_version_graph` | boolean | `true` | 启用版本 Graph UI |
| `features.enable_mcp_push` | boolean | `true` | 启用 MCP 推送 |
| `features.enable_remote_preview` | boolean | `false` | 启用远程 URL 预览 |
| `features.enable_auto_apply` | boolean | `false` | 允许 Agent 自动应用 patch |

### 环境变量

| 环境变量 | 对应配置项 | 类型 | 说明 |
|----------|-----------|------|------|
| `HTML_EDITOR_PORT` | server.port | number | 服务端口 |
| `HTML_EDITOR_HOST` | server.host | string | 监听地址 |
| `HTML_EDITOR_NO_OPEN` | server.open_browser | boolean(反转) | 设置时不打开浏览器 |
| `HTML_EDITOR_MAX_FILE_SIZE` | preview.max_file_size | number | 最大文件大小 |
| `HTML_EDITOR_NO_WATCH` | preview.watch | boolean(反转) | 设置时不监听文件 |
| `HTML_EDITOR_NO_PERSIST` | annotation.persist | boolean(反转) | 设置时不持久化标注 |
| `HTML_EDITOR_STORAGE_DIR` | version.storageDir | string | 数据存储目录 |
| `HTML_EDITOR_MAX_VERSIONS` | version.max_versions | number | 最大版本数 |
| `ENABLE_REMOTE_PREVIEW` | features.enable_remote_preview | boolean | 远程预览开关 |
| `ENABLE_AUTO_APPLY` | features.enable_auto_apply | boolean | 自动应用开关 |
| `ENABLE_INK_ANNOTATION` | features.enable_ink_annotation | boolean | 笔迹圈画开关 |
| `ENABLE_VERSION_GRAPH` | features.enable_version_graph | boolean | 版本 Graph 开关 |

**优先级：** 环境变量 > config.json > 默认值

---

## 常见工作流

### 完整闭环：预览 → 标注 → 提交 → Patch

以下是通过 MCP 集成的典型工作流：

```
1. 用户对 Agent 说："预览一下 index.html"
2. Agent 调用 preview_html → 创建 v1 版本，返回预览 URL
3. 用户打开浏览器 → 看到 HTML 渲染 + 标注工具栏
4. 用户用笔迹圈画 / 选择元素进行标注，输入评论
5. 用户点击"发送给 Agent"按钮
6. 标注数据推送给 Agent（版本自动 seal）
7. Agent 调用 get_annotations 获取结构化标注
8. Agent 根据标注内容生成 patch
9. Agent 调用 apply_patch → 生成 v1.1 新版本
10. 预览自动切换到 v1.1
11. 如不满意，可继续标注 → 生成 v1.1.1
12. 循环迭代直到满意
```

### CLI 独立工作流

无需 Agent 环境，通过 CLI 手动操作：

```bash
# 1. 启动预览
html-editor preview ./index.html
# 返回 session_id 和 version_id

# 2. 在浏览器中标注后，导出标注
html-editor annotations export --version ver-001 --format-export md --out feedback.md

# 3. 将反馈文件交给 Agent 或人工处理

# 4. 准备 patch 文件并应用
html-editor patch apply ./patches.json --version ver-001

# 5. 查看版本历史
html-editor versions list --session sess-001

# 6. 对比版本差异
html-editor versions diff ver-001 ver-002 --format text
```

### 版本分支工作流

```bash
# 从 v1 创建修改得到 v1.1
html-editor patch apply fix1.json --version ver-001

# 不满意 v1.1，从 v1 重新开始
html-editor versions checkout ver-001

# 重新标注后应用不同的 patch 得到 v1.2
html-editor patch apply fix2.json --version ver-001

# 对比两个分支
html-editor versions diff ver-001-1 ver-001-2
```

---

## 错误码参考

### Preview 模块

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| `PREVIEW_FILE_NOT_FOUND` | 文件不存在 | filePath 指向不存在的文件 |
| `PREVIEW_INVALID_FORMAT` | 文件格式不支持 | 非 .html/.htm 扩展名 |
| `PREVIEW_PORT_CONFLICT` | 端口冲突 | 指定端口已被占用 |
| `PREVIEW_SESSION_NOT_FOUND` | 会话不存在 | sessionId 无效或已关闭 |
| `PREVIEW_FILE_TOO_LARGE` | 文件过大 | 超过 5MB 限制 |

### Annotation 模块

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| `ANNOTATION_VERSION_NOT_FOUND` | 版本不存在 | versionId 无效 |
| `ANNOTATION_NOT_FOUND` | 标注不存在 | annotationId 无效 |
| `ANNOTATION_VERSION_SEALED` | 版本已封存 | 尝试修改 sealed 版本的标注 |
| `ANNOTATION_EMPTY` | 无标注数据 | submit 时无标注 |

### Version 模块

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| `VERSION_NOT_FOUND` | 版本不存在 | versionId 无效 |
| `VERSION_PARENT_NOT_FOUND` | 父版本不存在 | parentId 无效 |
| `VERSION_HTML_EMPTY` | HTML 内容为空 | htmlContent 为空字符串 |
| `VERSION_SESSION_NOT_FOUND` | 会话不存在 | sessionId 无效 |
| `VERSION_ALREADY_SEALED` | 版本已封存 | 尝试修改已 sealed 的版本 |

### Patch 模块

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| `PATCH_VERSION_NOT_FOUND` | 版本不存在 | versionId 无效 |
| `PATCH_EMPTY` | patch 数组为空 | patches 长度为 0 |
| `PATCH_ALL_FAILED` | 所有 patch 均失败 | 无一成功应用 |
| `PATCH_CONTENT_MISMATCH` | 内容校验失败 | oldContent 与实际不匹配 |
| `PATCH_INVALID_ACTION` | 操作类型无效 | action 不在支持范围内 |

### Snapshot 模块

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| `SNAPSHOT_VERSION_NOT_FOUND` | 版本不存在 | versionId 无效 |
| `SNAPSHOT_SELECTOR_INVALID` | 选择器无效 | CSS selector 语法错误 |
| `SNAPSHOT_ELEMENT_NOT_FOUND` | 元素不存在 | selector 匹配不到元素 |
| `SNAPSHOT_BOUNDS_INVALID` | 包围盒无效 | width/height ≤ 0 |

---

## FAQ

### Q: 支持哪些 HTML 文件格式？

A: 支持 `.html` 和 `.htm` 扩展名的文件，大小限制为 5MB。

### Q: 标注数据存储在哪里？

A: 所有数据存储在项目目录下的 `.html-editor/` 文件夹中：
- `versions/` — 版本快照和标注
- `working/` — 当前工作副本
- `annotations/` — CLI Gateway 导出的标注文件

建议将 `.html-editor/` 添加到 `.gitignore`。

### Q: 版本 seal 后还能修改吗？

A: 不能。版本一旦 seal（通过"发送给 Agent"按钮提交，或通过 apply_patch 创建新版本后），就变为不可变只读状态。如需修改，请从该版本 checkout 一个新的 working copy。

### Q: MCP Gateway 和 CLI Gateway 有什么区别？

A: 功能完全对等，区别仅在暴露方式：
- **MCP Gateway**：通过 MCP 协议与 Agent 通信，支持 notification 主动推送
- **CLI Gateway**：通过命令行调用，结果输出到 stdout 或文件

### Q: 笔迹圈画的数据会保存吗？

A: 笔迹路径（SVG path）本身不保存，仅作为临时圈选工具。保存的是：
- 圈画区域的截图（base64）
- hit-test 命中的 DOM 元素列表
- 确定的锚点元素
- 用户评论

### Q: 预览支持远程 URL 吗？

A: 默认不支持（安全考虑）。可通过设置 `ENABLE_REMOTE_PREVIEW=true` 开启。

### Q: 版本历史最多保留多少个？

A: 默认 200 个。可通过 `HTML_EDITOR_MAX_VERSIONS` 环境变量或配置文件调整。

### Q: 如何在 Agent 不可用时使用？

A: 直接使用 CLI Gateway：
```bash
html-editor preview ./index.html  # 启动预览
# 在浏览器中标注
html-editor annotations export --version <v> --out feedback.md  # 导出标注
```
标注数据以文件形式保存，随时可以被 Agent 读取。
