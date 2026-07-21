# RFC: Agent Native HTML 编辑插件

## 状态
- 提案日期：2026-07-20
- 状态：Draft

## 背景

设计并实现一个嵌入现有编码 Agent（如 Claude Code、Codex CLI）的插件，为用户提供"HTML 预览 + 笔迹圈画标注 + 版本管理 + Agent 定向修改"的完整工作流。

核心诉求：用户在当前正在使用的主 Agent 对话会话中，直接对网页内容进行可视化标注与反馈（包括笔迹圈画和 DOM 元素选择），并由该主 Agent 理解标注意图后完成定向修改，无需切换到独立应用。通过版本管理系统，用户可以追溯修改历史，对比不同版本，并在任意版本基础上创建分支迭代。

### 现有方案的不足
- **Plannotator**：仅支持 Markdown/Plan 标注，不支持 HTML artifact 的实时 DOM 标注
- **HTML Anything**：聚焦于 HTML 生成与导出，无标注/反馈能力；且为独立应用，需主动调度 Agent CLI

### 本方案定位
取两者之长：参考 Plannotator 的标注系统设计（数据结构、反馈循环、Agent 集成），参考 HTML Anything 的渲染架构（iframe sandbox、流式预览、diff-edit），以 Core Service + 双 Gateway 同构架构（MCP Gateway / CLI Gateway / Skill / Plugin）实现跨 Agent 通用的解决方案，同时支持脱离 Agent 独立使用。

## 目标

1. 提供基于 iframe 的 HTML 实时预览，支持本地 HTML 文件渲染
2. 在预览页面上提供**笔迹圈画标注**能力（freehand drawing + 自动 hit-test DOM 命中）
3. 在预览页面上提供 DOM 节点级别的选择标注能力（选区绘制 + 评论输入）
4. 标注数据结构化输出，支持两种 Gateway 推送给 Agent：
   - MCP Gateway：通过页面按钮主动推送标注
   - CLI Gateway：写入项目目录文件，Agent 自行读取
5. Agent 基于标注反馈（含笔迹截图 + 命中 DOM）进行定向最小化修改
6. **版本管理系统**：每次修改生成不可变版本，支持版本树浏览、对比、分支
7. 修改后自动刷新预览，形成闭环迭代
8. 跨 Agent 兼容（Claude Code、Codex CLI、Cursor 等所有 MCP 客户端）
9. **CLI 可独立使用**：脱离 Agent 环境，通过命令行工具完成预览、标注、导出

## 非目标

1. 不自行调度或拉起外部 Agent CLI 进程（区别于 HTML Anything）
2. 不做通用富文本编辑器（不是 Notion/Google Docs 竞品）
3. 不做图像/视频标注工具（不是 Label Studio 竞品）
4. 不处理多用户协作编辑（V1 为单用户）
5. 不做模板/Skill 市场（区别于 HTML Anything 的 75 skills）
6. 不做完整的 Git 版本控制替代品（版本管理仅针对 HTML 预览标注的迭代流程）

## 详细方案

### 总体架构（Core Service + Gateway 同构设计）

核心设计理念：**CLI 和 MCP 功能完全同构，仅 Gateway 不同**。所有业务逻辑统一实现在 Core Service 层，CLI 和 MCP 只是暴露方式（Gateway）不同的薄封装。

```
┌─────────────────────────────────────────────────────┐
│  Plugin 层（Claude Code / Codex 插件包装）            │
│  - skills/（slash commands 触发工作流）              │
│  - hooks/（文件变更自动刷新）                        │
│  - plugin.json（元数据）                            │
├─────────────────────────────────────────────────────┤
│  Skill 层（Agent 自动识别 & 调用指导）              │
│  - 标注处理规则                                     │
│  - 修改策略指导                                     │
├─────────────────────────────────────────────────────┤
│  Gateway 层（同构能力，不同暴露方式）                │
│  ┌───────────────────┬───────────────────┐          │
│  │   MCP Gateway     │   CLI Gateway     │          │
│  │  · stdio/HTTP 传输 │  · 命令行接口      │          │
│  │  · Agent 实时调用  │  · 脚本/手动调用   │          │
│  │  · 双向推送       │  · 文件系统 I/O    │          │
│  └─────────┬─────────┴─────────┬─────────┘          │
│            │                   │                    │
│            └─────────┬─────────┘                    │
│                      ▼                              │
├─────────────────────────────────────────────────────┤
│  Core Service 层（核心业务逻辑）                     │
│  - PreviewService: HTML 渲染 & 热更新               │
│  - AnnotationService: 标注数据 CRUD & 导出          │
│  - VersionService: 版本创建/checkout/对比/Graph      │
│  - PatchService: DOM 定位 & diff 应用               │
│  - SnapshotService: DOM 快照 & hit-test             │
└─────────────────────────────────────────────────────┘
```

**关键说明**：
- **Core Service 是唯一的业务实现层**，所有逻辑在这里。CLI 和 MCP 都是调用 Core Service 的薄封装
- **功能完全对等**：每个 MCP 工具都有对等的 CLI 命令，反之亦然
- **差异仅在 Gateway 行为**：
  - **输入方式**：MCP 接收 JSON-RPC 调用；CLI 接收命令行参数 + stdin
  - **输出方式**：MCP 返回 MCP Content（textContent/imageContent）；CLI 输出到 stdout/文件
  - **推送机制**：MCP 通过 notification 主动推送给 Agent；CLI 将标注写入项目目录文件（`.html-editor/annotations/`）供 Agent 读取
  - **生命周期**：MCP 随 Agent 会话启动/停止；CLI 按需执行单次命令
- **Plugin/Skill 层**是 Agent 特定的包装（Claude Code / Codex 各有不同），不涉及业务逻辑
- 用户可以仅使用 CLI Gateway：预览 → 标注 → 导出标注文件到项目目录 → Agent 自行读取
- 也可以使用 MCP Gateway：预览 → 标注 → 点击按钮 → 标注通过 MCP 主动推送给 Agent

### 模块详细设计

#### 模块 1：Core Service 层

**技术选型**：TypeScript + Node.js

Core Service 是统一的业务实现层，不关心调用来源（CLI 还是 MCP），提供纯业务逻辑。

**服务定义**：

| 服务 | 职责 | 核心方法 |
|------|------|----------|
| `PreviewService` | HTML 渲染 & 热更新 | `start(file)`, `stop(session)`, `refresh(session)` |
| `AnnotationService` | 标注数据 CRUD & 导出 | `getAll(version)`, `submit(version)`, `export(version, format)` |
| `VersionService` | 版本创建/checkout/对比/Graph | `create(parent, html)`, `checkout(version, opts)`, `compare(a, b)`, `history(session)` |
| `PatchService` | DOM 定位 & diff 应用 | `apply(version, patches)`, `preview(version, patches)` |
| `SnapshotService` | DOM 快照 & hit-test | `get(version, selector)`, `hitTest(version, bounds)` |

**数据存储**：
- 标注数据：`.html-editor/annotations/{version_id}.json`
- 版本数据：`.html-editor/versions/`
- HTML 快照：`.html-editor/snapshots/`

#### 模块 2：Gateway 层（MCP Gateway + CLI Gateway）

Gateway 是 Core Service 的薄封装，职责仅为：参数解析 → 调用 Core Service → 格式化输出。两个 Gateway 功能完全对等。

##### MCP Gateway

**技术选型**：TypeScript + `@modelcontextprotocol/sdk`

**工具注册**（每个工具内部直接调用 Core Service 方法）：

| 工具名 | 输入 | 输出 | 对应 Core Service |
|--------|------|------|----------------|
| `preview_html` | `{ file_path, port? }` | `{ url, session_id, version_id }` | `previewService.start(file)` |
| `get_annotations` | `{ version_id, status? }` | `{ annotations[], version }` | `annotationService.getAll(version)` |
| `apply_patch` | `{ version_id, patches[] }` | `{ new_version_id, diff }` | `patchService.apply(version, patches)` |
| `get_dom_snapshot` | `{ version_id, selector? }` | `{ html, tree }` | `snapshotService.get(version, selector)` |
| `get_version_history` | `{ session_id }` | `{ versions[], graph }` | `versionService.history(session)` |
| `checkout_version` | `{ version_id, keep_annotations }` | `{ working_version_id }` | `versionService.checkout(version, opts)` |
| `create_version` | `{ parent_id, html_content, annotations? }` | `{ version_id }` | `versionService.create(parent, html)` |
| `compare_versions` | `{ version_a, version_b }` | `{ diff, annotations_a, annotations_b }` | `versionService.compare(a, b)` |
| `close_preview` | `{ session_id }` | `{ success }` | `previewService.stop(session)` |

**启动方式**：stdio（本地）

```json
// .mcp.json
{
  "mcpServers": {
    "html-editor": {
      "command": "node",
      "args": ["./dist/gateway/mcp/index.js"],
      "env": { "PORT": "0" }
    }
  }
}
```

**推送机制**：
- Agent → Server：标准 MCP tool_use 调用
- Server → Agent：页面点击“发送给 Agent”后，通过 MCP notification 推送标注数据

##### CLI Gateway

**技术选型**：TypeScript + Commander.js

**命令定义**（每个命令内部直接调用 Core Service 方法）：

| 命令 | 用途 | 对应 Core Service |
|------|------|----------------|
| `html-editor preview <file>` | 启动预览 | `previewService.start(file)` |
| `html-editor annotations list --version <v>` | 获取标注 | `annotationService.getAll(version)` |
| `html-editor annotations export --out <file>` | 导出标注 | `annotationService.submit(version)` |
| `html-editor patch apply <file>` | 应用修改 | `patchService.apply(version, patches)` |
| `html-editor snapshot <selector>` | 获取 DOM 快照 | `snapshotService.get(version, selector)` |
| `html-editor versions list` | 查看版本历史 | `versionService.history(session)` |
| `html-editor versions checkout <v> [--keep-annotations]` | 检出版本 | `versionService.checkout(version, opts)` |
| `html-editor versions create --parent <v>` | 创建版本 | `versionService.create(parent, html)` |
| `html-editor versions diff <v1> <v2>` | 版本对比 | `versionService.compare(a, b)` |

**推送机制**：
- 标注数据写入项目目录文件：`.html-editor/annotations/{version_id}.json`
- Agent 可通过文件系统自行读取，或用户手动告知 Agent 去读取

#### 同构映射表

以下表格展示 Core Service 方法与两个 Gateway 的完整对应关系：

| Core Service 方法 | MCP Gateway | CLI Gateway |
|-------------------|-------------|-------------|
| `previewService.start(file)` | `preview_html` tool | `html-editor preview <file>` |
| `annotationService.getAll(version)` | `get_annotations` tool | `html-editor annotations list --version <v>` |
| `annotationService.submit(version)` | MCP notification push | `html-editor annotations export --out <file>` |
| `patchService.apply(version, patches)` | `apply_patch` tool | `html-editor patch apply <file>` |
| `snapshotService.get(version, selector)` | `get_dom_snapshot` tool | `html-editor snapshot <selector>` |
| `versionService.history(session)` | `get_version_history` tool | `html-editor versions list` |
| `versionService.checkout(version, opts)` | `checkout_version` tool | `html-editor versions checkout <v> [--keep-annotations]` |
| `versionService.create(parent, html)` | `create_version` tool | `html-editor versions create --parent <v>` |
| `versionService.compare(a, b)` | `compare_versions` tool | `html-editor versions diff <v1> <v2>` |

#### 模块 3：预览渲染层

**技术选型**：Express/Fastify HTTP 服务 + WebSocket（hot reload）

**渲染方式**：
- iframe[sandbox="allow-scripts allow-same-origin"] + srcdoc（参考 HTML Anything）
- 注入标注 overlay 脚本到 iframe 内部
- 外部资源（CSS/JS CDN）通过 allow-same-origin 正常加载

**热更新机制**：
- 文件变更 → chokidar 监听 → WebSocket 推送 → iframe srcdoc 更新
- 参考 HTML Anything 的实时渲染：每次文件写入后立即更新 iframe

**URL 结构**：
```
http://localhost:{dynamic_port}/preview?file={encoded_path}&session={session_id}&version={version_id}
```

#### 模块 4：标注 Overlay 层

**技术选型**：React + web-highlighter（参考 Plannotator）+ SVG 覆盖层 + Canvas（截图）

**标注方式**：

所有标注统一为一种形式——**标注元素 + 评论**。笔迹圈画和直接点选元素只是**选中方式不同**，最终产物一样：锚定在某个 DOM 节点 + 评论。

| 选中方式 | 说明 | 额外数据 | 视觉表现 |
|----------|------|----------|----------|
| 点选元素 | 直接点击页面 DOM 元素 | 无 | 锚点标记 + 评论气泡 |
| 笔迹圈画 | 自由绘制圈选区域 | screenshot、hit_elements | 锚点标记 + hover 展示截图与 DOM 高亮 |

**笔迹圈画标注**：

核心能力：用户用鼠标/触控笔在页面上自由圈画，系统自动分析圈画区域。笔迹仅作为临时圈选工具，完成后立即消失，不持久化存储（浏览器窗口变形后 path 会失真，无意义）。

圈画流程：
1. 用户切换到"圈画模式"
2. 用鼠标/触控笔在页面上自由绘制（freehand drawing）
3. 笔迹实时渲染为临时 SVG path（仅绘制过程中可见）
4. 松开后自动触发：
   - **截图**：通过 Canvas capture 生成圈画区域的截图（base64）
   - **hit-test**：计算笔迹包围盒内命中的所有 DOM 元素（最差情况兆底命中 body）
   - **确定锚点**：从 hit-test 结果中选取主要 DOM 节点作为锚点（anchor_element）
   - **记录圈画区域**：保存 ink_region（圈画在视口中的坐标区域）作为位置补充
   - **清除笔迹**：临时笔迹从画布上移除
5. 弹出评论输入框，用户输入修改意见
6. 提交标注，数据包含：截图、锚点 DOM、hit-test DOM 列表、ink_region、评论

标注视觉呈现：
- 在 anchor_element 上显示锚点标记（📌或自定义 SVG icon）
- hover 锚点时：展示圈画截图 + 关联的 DOM 节点高亮

**DOM 点选标注**：

交互流程：
1. 用户点击“标注模式”按钮 → Overlay 激活
2. 鼠标悬停高亮 DOM 元素（pointer-events 穿透控制）
3. 点击选中元素
4. 弹出评论输入框
5. 提交 → 存储到标注数据层

**DOM 定位策略**：

由于每个版本的 HTML 是静态不可变的快照（sealed 后不会变化），标注是针对特定版本的，因此在同一个版本内 DOM 结构不会发生变化，CSS Selector 定位永远有效。无需 fallback 机制。

```typescript
interface DOMPosition {
  selector: string;           // CSS Selector（版本内永远有效）
  textOffset?: { start: number; end: number }; // 文本内偏移（可选）
}
```

#### 模块 5：页面推送按钮

预览页面中提供明确的 UI 按钮"发送给 Agent"（Submit Annotations）：

**MCP Gateway 模式**：
- 点击按钮后，标注数据（含笔迹截图 + hit-test DOM 信息）通过 MCP notification 主动推送给 Agent
- Agent 收到后立即开始处理标注，无需用户在对话中手动触发

**CLI Gateway 模式**：
- 点击按钮后，标注数据写入项目目录文件：`.html-editor/annotations/{version_id}.json`
- 文件包含完整标注信息（截图 base64、锚点 DOM、hit-test DOM 列表、评论）
- Agent 可通过文件系统自行读取，或用户手动告知 Agent 去读取

**按钮状态**：
- 无标注时禁用
- 有未提交标注时高亮提示
- 提交后显示确认状态

#### 模块 6：版本管理系统

这是一个核心模块，为标注-修改迭代流程提供完整的版本追溯能力。

**版本模型**：

```typescript
interface Version {
  id: string;                    // 版本唯一 ID
  version: string;               // 版本号，如 "v1.1", "v1.2.1"
  parent_id: string | null;      // 父版本 ID
  html_content: string;          // HTML 文件快照
  annotations: Annotation[];     // 该版本上的标注（版本的不可分割部分）
  sealed: boolean;               // 是否已封存
  timestamp: string;             // 创建时间
  metadata?: {
    agent?: string;              // 生成该版本的 Agent
    prompt_summary?: string;     // 生成时的 prompt 摘要
  };
}
```

**版本 seal 机制**：
- 新创建的版本初始为 `unsealed`（可编辑标注）
- `unsealed` 版本可以：增加标注、修改标注评论、删除标注
- 用户点击“发送给 Agent”时，版本自动 seal（标注随之固化）
- `sealed` 后，版本和标注都不可变，作为历史记录永久保留
- Agent 修改后产生的新版本初始也是 `unsealed` 的（用户可继续标注）

**版本规则**：
- 版本 seal 后即为**只读不可变**（immutable），包括其上的所有标注
- 标注是版本的不可分割部分，跟随版本一起 seal
- 版本号采用树形编号：v1 → v1.1 / v1.2；v1.1 → v1.1.1 / v1.1.2

**版本操作**：

| 操作 | 说明 | 触发方式 |
|------|------|---------|
| 查看版本对比 | 选择两个版本，展示 HTML diff + 各自标注 | UI 面板选择 |
| Checkout 版本 | 从历史版本创建新分支 | UI 或 MCP 调用 |
| 编辑标注 | 在 unsealed 工作版本上增删改标注 | 标注 UI |
| 提交版本 | 标注完成后提交，版本自动 seal | “发送给 Agent”按钮 |
| 发送给 Agent | 将版本+标注发送给 Agent，Agent 生成修改 | 按钮触发 |

**Checkout 选项**：
- 继承该版本的标注（复制到新版本进行编辑）
- 从空白标注开始

#### 模块 7.5：标注侧边栏

参考 Plannotator 的设计，页面右侧显示当前版本所有标注列表：

**布局**：
- 位置：页面右侧面板，宽度 300px，可折叠
- 每个 item 显示：锚点元素标签摘要（如 `<h1>`, `<div.hero>`）、评论内容（截断）、时间戳

**CRUD 操作**：
- 新增：通过页面上圈画/点选创建，自动出现在侧边栏列表
- 查看：hover item → 页面上对应锚点高亮
- 编辑：点击 item → 展开编辑评论
- 删除：item 上的删除按钮

**点击 item 滚动定位**：
- 点击标注 item → 预览 iframe 滚动到对应 DOM 元素
- 如果页面是 SPA（有前端路由），先进行路由跳转到对应页面，再滚动到元素位置

#### 模块 7.6：HTML 格式错误反馈机制

当 HTML 文件存在格式错误（解析失败、渲染异常等）时：

1. 预览页面上显示错误信息（而不是空白或崩溃）
2. 页面上提供一个**“反馈给 Agent 修复”按钮**
3. 点击按钮后：
   - **MCP Gateway**：将错误信息（错误类型、错误位置、原始 HTML 片段）主动推送给 Agent，请求修复
   - **CLI Gateway**：将错误信息写入项目目录文件（`.html-editor/errors/{version}.json`）
4. Agent 收到错误反馈后可以进行修复，修复后产生新版本

**版本历史 Graph UI**：
- 可视化展示版本树（类似 Git graph）
- 每个节点显示：版本号、缩略图、时间、标注数量
- 点击节点可查看该版本详情
- 连线表示父子关系
- 支持在任意节点上右键 checkout 创建分支

**版本存储**：
```
.html-editor/
├── versions/
│   ├── index.json              # 版本索引（树结构）
│   ├── v1/
│   │   ├── snapshot.html       # HTML 快照
│   │   └── annotations.json   # 标注数据
│   ├── v1.1/
│   │   ├── snapshot.html
│   │   └── annotations.json
│   └── ...
└── working/                    # 当前工作版本（可编辑）
    ├── snapshot.html
    └── annotations.json
```

#### 模块 7：标注数据协议

**数据结构**：

```typescript
// 统一标注接口
interface Annotation {
  id: string;                          // 唯一标识
  anchor_element: DOMPosition;         // 标注锚点的 DOM 节点
  screenshot?: string;                 // 圈画截图（笔迹圈画方式产生时有）
  hit_elements?: HitElement[];         // 命中的 DOM 元素列表（笔迹圈画方式产生时有）
  comment: string;                     // 用户评论（修改意见/意图说明）
  status: 'pending' | 'resolved';      // 标注状态
  timestamp: string;                   // ISO 8601
  version_id: string;                  // 所属版本
}

// hit-test 命中元素
interface HitElement {
  selector: string;              // CSS Selector
  tag: string;                   // 标签名
  outer_html_summary: string;    // outerHTML 摘要（截断到 200 字符）
  bounding_rect: DOMRect;        // 元素位置
}

// Patch 操作
interface Patch {
  annotation_id: string;               // 关联的标注
  selector: string;                    // 修改目标
  action: 'replace' | 'delete' | 'insert_before' | 'insert_after' | 'modify_style';
  content?: string;                    // 新内容
  old_content?: string;                // 原内容（校验用）
}

// HTML 格式错误反馈
interface HtmlError {
  type: 'parse_error' | 'render_error' | 'resource_missing';
  message: string;                     // 错误描述
  location?: {                         // 错误位置（如果可定位）
    line: number;
    column: number;
    context: string;                   // 前后几行的代码片段
  };
  file_path: string;
  version_id: string;
}
```

**导出格式**（给 Agent 的反馈文本）：

```
## 用户标注反馈（版本 v1.1）

### [标注 1] div.hero > h1
原始内容: <h1 class="title">Welcome to Our Site</h1>
用户意见: 标题太大，改小一点，颜色换成品牌色 #1a73e8

## [标注 2] div.hero
命中元素:
  - div.hero > h1 (标题文本)
  - div.hero > p.subtitle (副标题)
截图: [base64 data]
用户意见: 这个区域的排版太紧凑了，标题和副标题之间加点间距

### [标注 3] body > .sidebar
用户意见: 删除这个侧边栏
```

**导出说明**：不再按标注类型分组，统一为"元素+评论"列表，每条标注包含锚点元素摘要、评论内容、可选截图与命中元素。

#### 模块 8：文件操作与 Diff

**技术选型**：diff-match-patch + 自定义 DOM-aware diff

**apply_patch 流程**：
1. 读取当前版本的 HTML 快照
2. 用 CSS Selector 定位目标节点（版本 HTML 是静态的，selector 永远有效）
3. 应用修改（替换/删除/插入）
4. 生成 diff 输出（给 Agent 确认）
5. **创建新版本**：将修改后的 HTML 作为新版本快照保存
6. 触发预览切换到新版本

**最小化修改原则**（参考 HTML Anything 的 diff-edit）：
- Agent 每次修改只基于标注片段做定向更新
- 保留原 HTML 的结构/样式/布局，仅修改标注指出的部分
- apply_patch 工具接受精确的 Patch 数组，而非全量 HTML

### Skill 层设计

**标注处理规则**（Agent 自动识别并遵循）：
- 收到标注时：参考 anchor_element 定位目标 DOM，结合 comment 理解用户意图
- 如果标注含 screenshot 和 hit_elements：优先参考截图理解用户圈画意图，结合 hit_elements 定位需要修改的 DOM
- 如果标注仅有 anchor_element + comment：按 anchor_element 精确定位元素进行修改
- 收到 HTML 错误反馈时：根据错误位置和上下文进行修复

**修改策略指导**：
- 每次修改后必须调用 `create_version` 或 `apply_patch` 生成新版本
- 修改范围不超出标注指示
- 保持未标注区域不变

### Plugin 层包装（Claude Code）

**目录结构**（体现 Core Service + 双 Gateway 同构设计）：
```
html-editor-plugin/
├── src/
│   ├── core/                    # Core Service 层（纯业务逻辑）
│   │   ├── preview.service.ts
│   │   ├── annotation.service.ts
│   │   ├── version.service.ts
│   │   ├── patch.service.ts
│   │   └── snapshot.service.ts
│   ├── gateway/                 # Gateway 层（薄封装）
│   │   ├── mcp/                 # MCP Gateway
│   │   │   ├── index.ts         # MCP Server 入口
│   │   │   ├── tools.ts         # 工具注册（调用 core）
│   │   │   └── notifications.ts # 主动推送
│   │   └── cli/                 # CLI Gateway
│   │       ├── index.ts         # CLI 入口（commander/yargs）
│   │       ├── commands/        # 命令定义（调用 core）
│   │       └── output.ts        # 格式化输出
│   └── ui/                      # 前端标注 UI
│       ├── overlay/             # 标注 Overlay
│       ├── sidebar/             # 标注侧边栏
│       ├── version-graph/       # 版本历史 Graph
│       └── toolbar/             # 工具栏
├── skills/                      # Skill 层
│   ├── html-preview/
│   │   └── SKILL.md
│   ├── html-annotations/
│   │   └── SKILL.md
│   └── html-apply/
│       └── SKILL.md
├── hooks/
│   └── hooks.json
├── .mcp.json
├── plugin.json
└── package.json
```

**Skill 示例**（/html-preview）：
```yaml
---
name: html-preview
description: 预览 HTML 文件并启动标注模式，用户可以在预览中笔迹圈画或选择元素进行标注
allowed-tools:
  - mcp__html-editor__preview_html
  - mcp__html-editor__get_annotations
  - mcp__html-editor__get_version_history
---

# HTML 预览与标注

当用户需要预览 HTML 文件或对网页进行视觉反馈时使用此技能。

## 使用流程
1. 调用 `preview_html` 工具启动预览（创建初始版本）
2. 告知用户预览 URL，等待用户在浏览器中完成标注
3. 用户点击"发送给 Agent"后，通过 MCP 收到标注推送
4. 根据标注内容（含笔迹截图+命中 DOM）进行定向最小化修改
5. 调用 `apply_patch` 生成新版本，预览自动切换
6. 用户可在版本 Graph 中对比或继续标注
```

### 用户交互全链路

```
1. 用户对 Agent 说："预览一下 index.html"
2. Agent 调用 preview_html → 创建 v1 版本，返回预览 URL
3. 用户打开浏览器 → 看到 HTML 渲染 + 标注工具栏 + 版本面板
4. 用户用笔迹圈画 / 选择元素进行标注，输入评论
5. 用户点击"发送给 Agent"按钮
6. [MCP Gateway] 标注+截图+DOM 信息主动推送给 Agent（版本自动 seal）
   [CLI Gateway] 标注写入 .html-editor/annotations/v1.json（版本自动 seal）
7. Agent 理解标注（含笔迹截图+命中 DOM），生成修改方案
8. Agent 调用 apply_patch → 生成 v1.1 新版本
9. 预览切换到 v1.1，用户看到修改结果（新版本初始为 unsealed，可继续标注）
10. 用户可在版本 Graph 中对比 v1 和 v1.1
11. 如不满意，可从 v1 checkout 新分支，重新标注后发送给 Agent → 生成 v1.2
12. 循环迭代直到满意
```

## 备选方案对比

| 维度 | 方案 A（本方案） | 方案 B（Plannotator 集成） | 方案 C（独立应用，类 HTML Anything） |
|------|----------|-----------------|---------------------|
| 标注对象 | 实时 DOM + 笔迹圈画 | Markdown/导入副本 | 无标注（仅生成） |
| Agent 通信 | MCP 标准协议 + 主动推送 | Hook stdin/stdout | CLI spawn |
| 跨 Agent | ✅ 所有 MCP 客户端 | ⚠️ 需逐个 hook 适配 | ⚠️ 需逐个 adapter |
| HTML 实时预览 | ✅ iframe + hot reload | ❌ 静态导入 | ✅ iframe + SSE 流式 |
| Agent 调度 | 不调度（复用主 Agent） | 不调度（hook 拦截） | 主动调度 CLI |
| 安装方式 | 插件安装 / CLI 独立使用 | 插件安装（hooks） | 独立应用部署 |
| 修改精度 | DOM 节点级 patch | 重新生成 Plan | 全量重新生成 / diff-edit |
| 版本管理 | ✅ 内置版本树 | ❌ 无 | ❌ 无 |
| 脱 Agent 使用 | ✅ CLI Gateway 独立运行 | ❌ 依赖 Agent | ⚠️ 部分功能可独立 |

## 迁移与回滚

### 迁移策略
- V1 阶段为纯增量插件，不依赖任何现有系统，安装即用
- 数据存储在项目目录 `.html-editor/` 下，跟随项目版本管理
- MCP Server 独立进程，崩溃不影响主 Agent 会话
- CLI Gateway 可独立使用，不需要任何 Agent 环境

### 回滚方案
- 移除 .mcp.json 中的 server 配置即可完全停用 MCP Gateway
- CLI 工具可继续独立使用
- 版本数据保留在 `.html-editor/` 目录，可随时恢复
- 所有文件修改通过 git 可追溯回滚

## 灰度策略

### 阶段发布
1. **Alpha（内部测试）**：CLI Gateway + MCP Gateway 基础工具 + Claude Code 插件 + 基础标注（DOM 选择）
2. **Beta（社区测试）**：笔迹圈画标注 + 版本管理 + Codex CLI 支持
3. **GA（正式发布）**：全 Agent 支持 + 版本 Graph UI + 插件市场上架

### 功能开关
- `ENABLE_REMOTE_PREVIEW`：是否允许预览远程 URL（安全风险，默认关闭）
- `ENABLE_AUTO_APPLY`：是否允许 Agent 自动应用 patch（默认需用户确认）
- `ENABLE_INK_ANNOTATION`：是否启用笔迹圈画标注（Beta 默认开启）
- `ENABLE_VERSION_GRAPH`：是否启用版本 Graph UI（Beta 默认开启）
- `ENABLE_ANNOTATION_SIDEBAR`：是否启用标注侧边栏（Beta 默认开启）
- `ANNOTATION_PERSIST`：标注数据是否持久化到磁盘（默认开启）

## 后续可选功能

以下功能不在 V1 范围内，但作为后续迭代方向：

### 1. Figma 风格节点树

类似 Figma 的 DOM 节点树面板 + 元素选择高亮，作为笔迹圈选的精确补充：
- 左侧面板展示 DOM 树结构
- 点击树节点高亮对应页面元素
- 支持多选节点批量标注
- 节点树与页面圈选联动（圈画后自动展开对应节点）

### 2. 自动重新生成

当某个版本节点没有后继节点时，可以触发大模型基于「父版本 HTML + 当前标注」重新生成一版新 HTML：
- 版本 Graph 中显示"自动生成"按钮（仅叶子节点可用）
- 触发后 Agent 读取当前版本的标注，自动生成修改方案并创建新版本
- 适用于用户标注完成后希望一键让 Agent 处理的场景

## 验收标准

### MVP 验收（Alpha）
1. ✅ 能通过 CLI 命令独立启动本地 HTML 文件预览
2. ✅ 能通过 MCP 工具启动本地 HTML 文件预览
3. ✅ 预览页面能进行 DOM 元素级选择标注（点选 + 评论）
4. ✅ Agent 能通过 get_annotations 获取结构化标注数据
5. ✅ Agent 能通过 apply_patch 对源文件进行定向修改
6. ✅ 修改后预览自动刷新
7. ✅ 完整闭环：预览 → 标注 → Agent 修改 → 预览更新
8. ✅ 页面“发送给 Agent”按钮正常工作（版本自动 seal + MCP Gateway 推送 / CLI Gateway 写文件）
9. ✅ HTML 格式错误时显示错误页面，点击反馈按钮可推送错误信息给 Agent

### Beta 验收
1. ✅ 笔迹圈画标注功能：自由绘制 → 截图生成 → hit-test DOM 命中
2. ✅ 版本管理基础功能：版本创建、版本只读、版本检出
3. ✅ 版本对比：两个版本间的 HTML diff + 标注对比
4. ✅ InkAnnotation 数据结构完整（screenshot、anchor_element、hit_elements）
5. ✅ CLI Gateway 标注数据正确写入项目目录
6. ✅ 标注侧边栏正常显示当前版本标注列表
7. ✅ 版本 seal 机制正常工作（提交后不可修改）

### GA 验收
1. ✅ 版本 Graph UI 可视化展示版本树
2. ✅ 跨 Agent 兼容验证（Claude Code + Codex CLI + Cursor）
3. ✅ 完整版本管理流程：创建 → 标注 → 提交 → 分支 → 对比

### 质量标准
- 标注定位准确率 > 95%（CSS Selector 在静态版本内永远有效）
- 笔迹 hit-test 准确率 > 90%（包围盒内元素正确识别）
- 预览刷新延迟 < 500ms
- MCP 工具响应时间 < 200ms
- 版本切换延迟 < 300ms
- 支持 HTML 文件大小 < 5MB
- 版本历史支持 100+ 节点流畅展示

### 兼容性验收
- Claude Code 完整工作流可用
- Codex CLI MCP 调用正常
- CLI Gateway 脱离 Agent 独立可用
- 至少 Chrome/Firefox/Safari 最新版本支持标注 UI（含笔迹圈画）
