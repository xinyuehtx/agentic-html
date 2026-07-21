# agentic-html 项目开发 Skill

## 项目概述

Agent Native HTML Editor Plugin — 提供 HTML 预览、用户标注、版本管理、补丁应用的一体化编辑能力。
核心架构为三层同构设计：**Core Service → Gateway (MCP/CLI) → UI (React)**。

## 快速命令参考

### 开发

- `pnpm dev:ui` — 启动前端开发服务器（Vite，root 为 src/ui）
- `pnpm build:ui` — 构建前端生产版本（输出到 dist/ui）
- `pnpm test` — 运行全量测试（vitest run）
- `pnpm test:watch` — 测试监听模式
- `pnpm test:coverage` — 运行测试并生成覆盖率报告
- `npx vitest run tests/unit/core/xxx.test.ts` — 运行单个测试文件
- `npx tsc --noEmit` — TypeScript 类型检查

### 检查流程

```bash
pnpm test          # 全量测试
npx tsc --noEmit   # 类型检查
```

### 测试目录

- 单元测试：`tests/unit/core/` + `tests/unit/gateway/`
- 集成测试：`tests/integration/`
- 测试配置：`vitest.config.ts`，全局 setup 文件 `tests/setup.ts`

## 项目架构

### 目录结构

```
src/
├── core/           # 核心业务逻辑（纯逻辑层，无 IO 依赖）
│   ├── types.ts          # 所有类型定义（JSON-serializable）
│   ├── errors.ts         # 错误基类 + 错误码枚举
│   ├── config.ts         # 配置系统（默认值 + 环境变量覆盖）
│   ├── preview.service.ts
│   ├── version.service.ts
│   ├── annotation.service.ts
│   ├── snapshot.service.ts
│   └── patch.service.ts
├── gateway/        # 接口层（将 Core Service 暴露为不同协议）
│   ├── mcp/              # MCP 协议网关（Agent 交互）
│   │   ├── tools.ts      # 工具定义 + handler 路由
│   │   ├── notifications.ts
│   │   └── index.ts
│   └── cli/              # CLI 网关（命令行调用）
│       ├── index.ts      # CliGateway 类 + 命令路由
│       ├── commands/
│       └── output.ts     # 输出格式化
└── ui/             # React 前端（Vite 构建）
    ├── components/       # UI 组件
    ├── hooks/            # React hooks
    ├── styles/           # CSS 样式
    ├── utils/            # 工具函数
    ├── App.tsx
    ├── main.tsx
    └── index.html
```

### 三层架构

```
Core Service (业务逻辑)
    ↓
Gateway (MCP snake_case / CLI kebab-case)
    ↓
UI (React + WebSocket)
```

### 核心 Service

| Service | 职责 |
|---------|------|
| `PreviewService` | 预览启动 (start) / 停止 (stop)，管理 PreviewSession |
| `VersionService` | 版本创建 (create) / 获取 (get) / 封存 (seal) / 签出 (checkout) / 对比 (compare) / 历史 (history) |
| `AnnotationService` | 标注 CRUD / 提交 (submit) / 导出 (export) |
| `SnapshotService` | DOM 快照获取 (get) / hit-test 检测 |
| `PatchService` | 补丁应用 (apply) / 预览 (preview) |

### MCP Gateway 工具列表

`preview_html`, `close_preview`, `get_annotations`, `apply_patch`, `get_dom_snapshot`, `get_version_history`, `checkout_version`, `create_version`, `compare_versions`

### CLI Gateway 命令

- `preview <file>` — 预览 HTML 文件
- `annotations list/export/submit` — 标注操作
- `patch apply/preview` — 补丁操作
- `snapshot` — DOM 快照
- `versions list/checkout/create/diff` — 版本管理

## 代码规范

### 命名约定

- Core Service 内部：**camelCase**（如 `versionId`, `htmlContent`）
- MCP Gateway 参数：**snake_case**（如 `version_id`, `file_path`）
- CLI Gateway 参数：**kebab-case**（如 `--version`, `--dry-run`, `--keep-annotations`）
- 文件名：**kebab-case**（如 `version.service.ts`, `patch.service.ts`）

### ES Module

- 项目为 `"type": "module"`
- 源代码导入使用 `.js` 扩展名：`import { X } from './core/types.js'`
- 测试文件使用路径别名时无需扩展名：`import { X } from '@/core/types'`
- 使用 `import/export`，不使用 `require`

### 路径别名

- `@/*` → `./src/*`（tsconfig.json `paths` + vite.config.ts `resolve.alias` + vitest.config.ts `resolve.alias`）

### TypeScript 配置

- `target`: ES2022
- `module`: ESNext
- `moduleResolution`: bundler
- `strict`: true
- 全局类型：`vitest/globals`, `node`

### 错误处理

- 所有错误继承 `HtmlEditorError` 基类（含 code, module, severity, recoverable, context）
- 错误码在 `src/core/errors.ts` 的 `ErrorCodes` 常量中定义，按模块分组
- Gateway 层捕获 `HtmlEditorError` 转为对应格式输出（MCP → JSON ToolResult, CLI → stderr + exit code）

### 类型设计原则

- 所有 Core 类型均为 JSON-serializable（用于 MCP 传输）
- 类型定义集中在 `src/core/types.ts`
- 接口使用明确区分：输入用 `Options`/`Data` 后缀，输出用 `Result` 后缀

## 新增功能标准流程

1. 在 `src/core/types.ts` 定义新类型（输入/输出接口）
2. 在 `src/core/errors.ts` 添加错误码（如需）
3. 创建/修改 Core Service（`src/core/xxx.service.ts`）
4. 编写单元测试（`tests/unit/core/xxx.test.ts`）
5. 在 MCP Gateway 注册工具（`src/gateway/mcp/tools.ts` 的 `handleTool` switch）
6. 在 CLI Gateway 注册命令（`src/gateway/cli/index.ts` 的 `execute` switch）
7. 编写 Gateway 测试（`tests/unit/gateway/`）
8. 如涉及 UI，在 `src/ui/components/` 添加组件 + 对应 hook
9. 运行 `pnpm test` + `npx tsc --noEmit` 确认无回归

## 测试与 Mock 策略

### 全局 Mock（tests/setup.ts）

- **文件系统**：`vi.mock('fs/promises')` — mock readFile, writeFile, mkdir, stat 等
- **UUID**：`vi.mock('uuid')` — 返回固定值 `'mock-uuid-1234'`
- **chokidar**：`vi.mock('chokidar')` — 返回链式 API mock（on/close）
- **状态重置**：每个测试前调用 `VersionService.reset()` + `AnnotationService.reset()`

### 测试 Fixtures（tests/setup.ts 导出）

- `SAMPLE_HTML` — 标准测试 HTML 页面
- `SAMPLE_CLICK_ANNOTATION` — 点选标注示例
- `SAMPLE_INK_ANNOTATION` — 圈画标注示例（含 screenshot + hit_elements）
- `SAMPLE_DELETE_ANNOTATION` — 删除类标注
- `SAMPLE_MODIFY_ANNOTATION` — 修改类标注
- `SAMPLE_PATCH` — 补丁操作示例
- `SAMPLE_VERSION` — 版本数据示例

### 常见问题排查

- 导入报错 → 检查源码中是否缺少 `.js` 扩展名
- 类型报错 → 确认 `@types/*` 包已安装（express, node, ws, uuid, react, react-dom）
- Service 状态污染 → 确保 `tests/setup.ts` 的 `beforeEach` 重置生效
- 集成测试共享实例 → 多 Service 协作时须使用同一个 VersionService 实例

## 版本管理数据结构

### 存储路径

```
.html-editor/versions/{versionId}/
  - meta.json        # 版本元信息
  - snapshot.html    # HTML 快照
  - annotations.json # 标注数据
```

### 默认配置（src/core/config.ts）

- `version.storageDir`: `.html-editor`
- `version.maxVersions`: 200
- `preview.maxFileSize`: 5MB
- `snapshot.hitTestThreshold`: 0.3

### 环境变量覆盖

- `HTML_EDITOR_PORT` — 预览端口
- `HTML_EDITOR_WATCH` — 是否监听文件变化
- `HTML_EDITOR_MAX_FILE_SIZE` — 最大文件大小
- `HTML_EDITOR_STORAGE_DIR` — 版本存储目录
- `HTML_EDITOR_MAX_VERSIONS` — 最大版本数

## 依赖速查

| 依赖 | 用途 |
|------|------|
| `@modelcontextprotocol/sdk` | MCP 协议实现 |
| `cheerio` | 服务端 HTML 解析/DOM 操作 |
| `diff-match-patch` | 文本差异对比 |
| `express` | 预览服务器 |
| `ws` | WebSocket 实时通信 |
| `chokidar` | 文件监听（热更新） |
| `commander` | CLI 命令解析 |
| `uuid` | 生成唯一 ID |
| `react` / `react-dom` | UI 框架 |
| `html2canvas` | 截图能力 |
