# agentic-html

[![npm version](https://img.shields.io/npm/v/agentic-html.svg)](https://www.npmjs.com/package/agentic-html)
[![test status](https://img.shields.io/github/actions/workflow/status/user/agentic-html/test.yml?label=tests)](https://github.com/user/agentic-html/actions)
[![license](https://img.shields.io/npm/l/agentic-html.svg)](./LICENSE)

[English](./README.md) | 中文

> Agent Native HTML 编辑插件 — 预览、标注、版本管理、补丁修改

## 功能亮点

- **HTML 实时预览** — 基于 iframe 的本地预览，WebSocket 热更新
- **笔迹圈画标注** — 自由绘制圈选区域，自动 hit-test 命中 DOM 元素
- **DOM 元素选择** — 点击选择元素并添加评论
- **版本管理** — 不可变版本树，支持分支、对比和检出
- **双 Gateway 架构** — MCP Gateway 对接 Agent + CLI Gateway 独立使用
- **跨 Agent 兼容** — 支持 Claude Code、Codex CLI、Cursor 及所有 MCP 客户端
- **精准修改** — DOM 节点级 Patch，非全量 HTML 重新生成
- **标注侧边栏** — 可视化标注列表，支持滚动定位到对应元素

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│  Gateway 层（同构能力，不同暴露方式）                          │
│  ┌─────────────────────┬─────────────────────┐              │
│  │   MCP Gateway        │   CLI Gateway        │              │
│  │  · stdio 传输        │  · 命令行参数         │              │
│  │  · Agent 实时调用    │  · 脚本/手动调用      │              │
│  │  · 双向推送          │  · 文件系统 I/O       │              │
│  └──────────┬──────────┴──────────┬──────────┘              │
│             └──────────┬──────────┘                          │
│                        ▼                                     │
├─────────────────────────────────────────────────────────────┤
│  Core Service 层（核心业务逻辑）                               │
│  · PreviewService    — HTML 渲染与热更新                      │
│  · AnnotationService — 标注数据 CRUD 与导出                   │
│  · VersionService    — 版本创建/检出/对比/Graph               │
│  · PatchService      — DOM 定位与 diff 应用                   │
│  · SnapshotService   — DOM 快照与 hit-test                    │
├─────────────────────────────────────────────────────────────┤
│  UI 层（浏览器端）                                            │
│  · 标注 Overlay · 笔迹画布 · 侧边栏 · 版本 Graph             │
└─────────────────────────────────────────────────────────────┘
```

## 截图

<!-- screenshots will be auto-generated -->

![预览界面](docs/screenshots/preview.png)
![笔迹圈画标注](docs/screenshots/annotation-ink.png)
![标注侧边栏](docs/screenshots/annotation-sidebar.png)
![版本图谱](docs/screenshots/version-graph.png)
![版本对比](docs/screenshots/version-diff.png)
![HTML 错误反馈](docs/screenshots/html-error-feedback.png)

## 为什么选择 agentic-html？

| 特性 | agentic-html | Codex | Claude Code |
|------|:---:|:---:|:---:|
| 显式版本树（v1→v1.1→v1.1.1） | ✅ | ❌ | ❌ |
| 跨 Agent 兼容（MCP 标准） | ✅ | ❌ | ❌ |
| CLI 工具链 | ✅ | ❌ | ❌ |
| 批注绑定版本 | ✅ | ❌ | ❌ |
| 笔迹圈画 + 截图 | ✅ | ✅ | ⚠️ |
| 开放协议与架构 | ✅ | ❌ | ❌ |
| 离线可用 | ✅ | ⚠️ | ⚠️ |
| 自动验证闭环 | ⚠️ 计划中 | ✅ | ✅ |
| 零配置启动 | ⚠️ | ✅ | ✅ |

**核心差异化优势：**

1. **版本树管理** — 显式树形版本结构，支持分支、回退和可视化 diff。Codex 和 Claude Code 仅提供隐式线性迭代，无 HTML 状态版本控制能力。
2. **标准 MCP 协议** — 兼容任何 MCP 客户端（Claude Code、Cursor、Codex CLI、自定义 Agent），不锁定特定平台。
3. **CLI + 开放架构** — 完整命令行工具链，可脚本化、可管道串联、可集成 CI/CD —— 而非封闭在桌面应用内的功能。

## 快速开始

### 安装

```bash
npm install agentic-html
```

或全局安装：

```bash
npm install -g agentic-html
```

### CLI 使用

```bash
# 启动预览
html-editor preview ./index.html

# 查看标注
html-editor annotations list --version <version_id>

# 应用补丁
html-editor patch apply patches.json --version <version_id>
```

### MCP 配置

在项目根目录创建 `.mcp.json`：

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

## CLI 命令参考

| 命令 | 描述 | 主要选项 |
|------|------|----------|
| `html-editor preview <file>` | 启动 HTML 实时预览 | `--port`, `--no-open`, `--no-watch` |
| `html-editor annotations list` | 获取版本标注列表 | `--version <id>` |
| `html-editor annotations export` | 导出标注 | `--version <id>`, `--out <file>`, `--format-export <md\|json>` |
| `html-editor patch apply <file>` | 应用 DOM 补丁 | `--version <id>`, `--dry-run` |
| `html-editor snapshot [selector]` | 获取 DOM 快照 | `--version <id>`, `--tree-only` |
| `html-editor versions list` | 查看版本历史 | `--session <id>`, `--graph` |
| `html-editor versions checkout <v>` | 检出版本 | `--keep-annotations` |
| `html-editor versions create` | 创建新版本 | `--parent <id>`, `--html <path>` |
| `html-editor versions diff <v1> <v2>` | 对比两个版本 | `--format <json\|text>` |

**全局选项：** `--format <json|text>`、`--project-dir <path>`、`--quiet`、`--verbose`

## MCP 工具参考

| 工具 | 描述 | 必填参数 |
|------|------|----------|
| `preview_html` | 启动 HTML 预览，创建初始版本 | `file_path` |
| `get_annotations` | 获取指定版本的标注数据 | `version_id` |
| `apply_patch` | 应用 DOM 补丁，生成新版本 | `version_id`, `patches[]` |
| `get_dom_snapshot` | 获取 DOM 树快照 | `version_id` |
| `get_version_history` | 获取完整版本 Graph | `session_id` |
| `checkout_version` | 检出版本到 working copy | `version_id` |
| `create_version` | 基于父版本创建新版本 | `parent_id`, `html_content` |
| `compare_versions` | 对比两个版本差异 | `version_a`, `version_b` |
| `close_preview` | 关闭预览会话 | `session_id` |

## 配置

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `HTML_EDITOR_PORT` | 服务端口 | `0`（自动分配） |
| `HTML_EDITOR_HOST` | 监听地址 | `localhost` |
| `HTML_EDITOR_NO_OPEN` | 禁止自动打开浏览器 | 未设置 |
| `HTML_EDITOR_MAX_FILE_SIZE` | 最大文件大小（字节） | `5242880`（5MB） |
| `HTML_EDITOR_NO_WATCH` | 禁止文件监听 | 未设置 |
| `HTML_EDITOR_STORAGE_DIR` | 数据存储目录 | `.html-editor` |
| `HTML_EDITOR_MAX_VERSIONS` | 单会话最大版本数 | `200` |
| `ENABLE_INK_ANNOTATION` | 启用笔迹圈画 | `true` |
| `ENABLE_VERSION_GRAPH` | 启用版本 Graph UI | `true` |

### 配置文件

配置文件位置：`.html-editor/config.json`

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

**优先级：** 环境变量 > config.json > 默认值

## 示例

参见 [examples/](./examples/) 目录获取完整工作流演示。

## 开发

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 测试监听模式
npm run test:watch

# 启动 UI 开发服务器
npm run dev:ui

# 构建 UI
npm run build:ui
```

完整开发指南请参阅 [docs/development.md](./docs/development.md)。

## 贡献

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 遵循[开发指南](./docs/development.md)
4. 确保测试通过 (`npm test`)
5. 提交更改
6. 发起 Pull Request

## 许可证

[MIT](./LICENSE)
