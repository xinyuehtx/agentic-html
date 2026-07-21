# 开发者指南

本文档面向 agentic-html 项目的开发者，介绍项目结构、开发环境搭建、测试方法和代码规范。

---

## 目录

- [项目结构说明](#项目结构说明)
- [本地开发环境搭建](#本地开发环境搭建)
- [测试运行方式](#测试运行方式)
- [新增功能标准流程](#新增功能标准流程)
- [代码规范](#代码规范)
- [调试技巧](#调试技巧)

---

## 项目结构说明

```
agentic-html/
├── src/
│   ├── core/                        # Core Service 层（纯业务逻辑）
│   │   ├── annotation.service.ts    # 标注数据 CRUD & 导出
│   │   ├── config.ts                # 配置加载与合并
│   │   ├── errors.ts                # 错误码定义
│   │   ├── index.ts                 # Core 统一导出
│   │   ├── patch.service.ts         # DOM 定位 & diff 应用
│   │   ├── preview.service.ts       # HTML 渲染 & 热更新
│   │   ├── snapshot.service.ts      # DOM 快照 & hit-test
│   │   ├── types.ts                 # 共享类型定义
│   │   └── version.service.ts       # 版本创建/检出/对比/Graph
│   ├── gateway/                     # Gateway 层（Core Service 的薄封装）
│   │   ├── cli/                     # CLI Gateway
│   │   │   ├── index.ts             # CLI 入口 & 命令路由
│   │   │   ├── commands/            # 各命令实现
│   │   │   └── output.ts            # 格式化输出
│   │   └── mcp/                     # MCP Gateway
│   │       ├── index.ts             # MCP Server 入口
│   │       ├── tools.ts             # Tool 注册 & 参数校验
│   │       └── notifications.ts     # Notification 推送
│   └── ui/                          # 前端 UI 层
│       ├── components/              # React 组件
│       │   ├── AnchorMarker.tsx     # 锚点标记
│       │   ├── AnnotationEditor.tsx # 标注编辑器
│       │   ├── AnnotationItem.tsx   # 标注列表项
│       │   ├── AnnotationSidebar.tsx# 标注侧边栏
│       │   ├── HtmlErrorBanner.tsx  # HTML 错误提示
│       │   ├── InkCanvas.tsx        # 笔迹画布
│       │   ├── Overlay.tsx          # 交互层
│       │   ├── PreviewFrame.tsx     # 预览 iframe
│       │   ├── SubmitButton.tsx     # 提交按钮
│       │   ├── Toolbar.tsx          # 工具栏
│       │   ├── VersionDiffModal.tsx # 版本对比弹窗
│       │   └── VersionGraph.tsx     # 版本 Graph
│       ├── hooks/                   # React Hooks
│       │   ├── useAnnotations.ts    # 标注状态管理
│       │   ├── useAppState.ts       # 全局状态
│       │   ├── useClickAnnotation.ts# 点击标注
│       │   ├── useInkAnnotation.ts  # 笔迹标注
│       │   ├── usePreviewSession.ts # 预览会话
│       │   ├── useScrollToElement.ts# 滚动定位
│       │   ├── useVersionGraph.ts   # 版本图谱
│       │   └── useWebSocket.ts      # WebSocket 连接
│       ├── styles/                  # CSS 样式
│       ├── utils/                   # 工具函数
│       ├── App.tsx                  # 根组件
│       ├── main.tsx                 # 入口文件
│       └── index.html               # HTML 模板
├── tests/
│   ├── unit/                        # 单元测试
│   │   ├── core/                    # Core Service 测试
│   │   └── gateway/                 # Gateway 测试
│   ├── integration/                 # 集成测试
│   └── setup.ts                     # 测试环境设置
├── dist/                            # 构建产物
├── docs/                            # 文档
├── rfcs/                            # RFC 设计文档
├── specs/                           # 技术规范文档
├── stories/                         # 用户故事
├── package.json
├── tsconfig.json                    # TypeScript 配置
├── vite.config.ts                   # Vite 构建配置
└── vitest.config.ts                 # Vitest 测试配置
```

### 层次职责

| 层 | 目录 | 职责 | 规则 |
|----|------|------|------|
| **Core Service** | `src/core/` | 纯业务逻辑实现 | 不依赖 Gateway，不关心调用来源 |
| **Gateway** | `src/gateway/` | Core Service 的薄封装 | 仅负责参数解析 → 调用 Core → 格式化输出，禁止包含业务逻辑 |
| **UI** | `src/ui/` | 浏览器端标注界面 | React 组件、通过 WebSocket 与后端通信 |

**关键设计原则：**
- CLI 和 MCP 功能完全同构，仅 Gateway 不同
- 每个 MCP 工具都有对等的 CLI 命令
- Gateway 层代码禁止包含业务逻辑

---

## 本地开发环境搭建

### 前置要求

- Node.js >= 18
- npm >= 9

### 安装

```bash
git clone <repo-url>
cd agentic-html
npm install
```

### 启动开发服务器

```bash
# 启动前端 UI 开发服务器（Vite，热更新）
npm run dev:ui
```

### 构建

```bash
# 构建前端 UI
npm run build:ui
```

### TypeScript 编译检查

```bash
npx tsc --noEmit
```

---

## 测试运行方式

项目使用 [Vitest](https://vitest.dev/) 作为测试框架。

### 运行所有测试

```bash
npm test
```

### 监听模式

```bash
npm run test:watch
```

### 覆盖率报告

```bash
npm run test:coverage
```

### 运行特定测试

```bash
# 运行单个文件
npx vitest run tests/unit/core/patch.service.test.ts

# 运行匹配模式的测试
npx vitest run --grep "PatchService"
```

### 测试分层

| 层级 | 目录 | 关注点 |
|------|------|--------|
| 单元测试 | `tests/unit/core/` | Core Service 各方法的正确性 |
| 单元测试 | `tests/unit/gateway/` | Gateway 参数解析和路由 |
| 集成测试 | `tests/integration/` | 完整工作流（预览→标注→Patch→版本） |

### 测试编写规范

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('ServiceName', () => {
  let service: ServiceType;

  beforeEach(() => {
    service = new ServiceType();
  });

  describe('methodName', () => {
    it('should handle normal case', async () => {
      const result = await service.method(input);
      expect(result).toMatchObject(expected);
    });

    it('should throw on invalid input', async () => {
      await expect(service.method(bad)).rejects.toThrow('ERROR_CODE');
    });
  });
});
```

---

## 新增功能标准流程

当需要添加新功能时，请按以下顺序进行：

### 1. 定义类型（`src/core/types.ts`）

```typescript
// 新增接口和类型定义
export interface NewFeatureOptions {
  param1: string;
  param2?: number;
}

export interface NewFeatureResult {
  id: string;
  data: unknown;
}
```

### 2. 定义错误码（`src/core/errors.ts`）

```typescript
export const ErrorCodes = {
  // ...existing codes...
  NEW_FEATURE_INVALID_INPUT: 'NEW_FEATURE_INVALID_INPUT',
  NEW_FEATURE_NOT_FOUND: 'NEW_FEATURE_NOT_FOUND',
} as const;
```

### 3. 实现 Core Service

在 `src/core/` 中创建或修改对应的 service 文件：

```typescript
export class NewFeatureService {
  async doSomething(options: NewFeatureOptions): Promise<NewFeatureResult> {
    // 业务逻辑实现
  }
}
```

### 4. 编写单元测试

在 `tests/unit/core/` 中添加测试：

```bash
# 确保测试通过
npx vitest run tests/unit/core/new-feature.service.test.ts
```

### 5. 注册 MCP Gateway Tool（`src/gateway/mcp/tools.ts`）

```typescript
case 'new_feature':
  return handleNewFeature(params, services);
```

### 6. 注册 CLI Gateway 命令（`src/gateway/cli/index.ts`）

```typescript
case 'new-feature':
  await this.handleNewFeature(remainingArgs.slice(1), outputOpts);
  break;
```

### 7. 编写 Gateway 测试

确保两个 Gateway 的行为一致。

### 8. 更新 UI（如需要）

在 `src/ui/` 中添加对应的组件和 hooks。

### 核心原则

- **先 Core 后 Gateway**：业务逻辑写在 Core，Gateway 只做薄封装
- **同步注册**：MCP 和 CLI 必须同时注册
- **参数命名约定**：
  - MCP：`snake_case`（如 `version_id`）
  - CLI：`kebab-case`（如 `--version-id`）
  - Core Service：`camelCase`（如 `versionId`）

---

## 代码规范

### ES Module

项目使用 ES Module（`"type": "module"`）：

```typescript
// 正确：使用 import/export
import { Something } from './module.js';
export function doThing() {}

// 错误：不使用 CommonJS
const { Something } = require('./module');
module.exports = {};
```

注意导入路径需要 `.js` 后缀（TypeScript 编译后的产物路径）。

### 命名约定

| 类型 | 风格 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `patch.service.ts`, `version-flow.test.ts` |
| 类名 | PascalCase | `PatchService`, `AnnotationService` |
| 接口名 | PascalCase | `PreviewSession`, `VersionDiff` |
| 方法名 | camelCase | `getAll()`, `hitTest()` |
| 常量 | UPPER_SNAKE_CASE | `ErrorCodes`, `VALID_PATCH_ACTIONS` |
| 类型别名 | PascalCase | `PatchAction`, `AnnotationStatus` |
| MCP 参数 | snake_case | `version_id`, `file_path` |
| CLI 参数 | kebab-case | `--version-id`, `--keep-annotations` |

### 错误处理

所有错误使用 `HtmlEditorError` 类：

```typescript
import { HtmlEditorError, ErrorCodes } from './errors.js';

// 抛出错误
throw new HtmlEditorError(
  ErrorCodes.VERSION_NOT_FOUND,
  `Version '${versionId}' not found`,
  'version',     // module
  'error',       // severity
  false,         // recoverable
  { versionId }  // context
);
```

Gateway 层捕获错误并格式化：

```typescript
try {
  const result = await service.method(params);
  return success(result);
} catch (err) {
  return wrapError(err, services);
}
```

### TypeScript 严格模式

- 启用 `strict: true`
- 所有函数参数和返回值必须有类型声明
- 避免使用 `any`，优先使用 `unknown` + 类型守卫
- 接口优先于类型别名（除简单联合类型外）

### 项目结构规则

- `src/core/` 中的文件不得 import `src/gateway/` 或 `src/ui/` 中的任何内容
- `src/gateway/` 中的文件只能 import `src/core/` 中的内容
- `src/ui/` 是独立的浏览器端代码，通过 WebSocket/HTTP 与 Core Service 通信

---

## 调试技巧

### 调试 MCP Gateway

1. 使用 `--verbose` 环境变量启动 MCP Server 查看日志：

```bash
HTML_EDITOR_VERBOSE=true node ./dist/gateway/mcp/index.js
```

2. 使用 MCP Inspector 工具调试工具调用：

```bash
npx @modelcontextprotocol/inspector node ./dist/gateway/mcp/index.js
```

### 调试 CLI Gateway

```bash
# 开启详细日志
html-editor --verbose preview ./test.html

# 查看 JSON 格式输出便于分析
html-editor --format json versions list --session <id>
```

### 调试前端 UI

1. 启动 Vite 开发服务器：
```bash
npm run dev:ui
```

2. 打开浏览器开发者工具：
   - Console：查看 WebSocket 消息和错误
   - Network：检查 API 请求
   - Elements：检查 overlay 分层结构

3. 关键 DOM 属性：
   - `data-annotation-layer` — 标注 overlay 层元素
   - `data-annotation-highlight` — 被高亮的标注元素
   - `data-sidebar-highlight` — 侧边栏点击高亮

### 调试测试

```bash
# 使用 Vitest UI 模式
npx vitest --ui

# 单步调试（结合 VS Code）
# 在 .vscode/launch.json 中配置：
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "${relativeFile}"],
  "console": "integratedTerminal"
}
```

### 常见问题排查

| 问题 | 排查方向 |
|------|----------|
| 端口冲突 | 检查 `lsof -i :<port>`，使用 `--port 0` 自动分配 |
| WebSocket 断开 | 检查浏览器控制台网络面板，确认端口匹配 |
| 标注不持久化 | 检查 `.html-editor/` 目录权限，确认 `annotation.persist` 配置 |
| hit-test 不准确 | 检查 `hit_test.threshold` 配置，调低阈值 |
| 版本创建失败 | 检查 `version.max_versions` 限制，确认 HTML 非空 |
| TypeScript 编译错误 | 运行 `npx tsc --noEmit` 查看完整错误信息 |
