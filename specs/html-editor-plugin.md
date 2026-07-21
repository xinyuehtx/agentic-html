# SPEC: Agent Native HTML 编辑插件 — 技术规范文档

> 对应 RFC: `rfcs/html-editor-plugin.md`
> 状态: Draft
> 日期: 2026-07-20

---

## 1. 模块接口契约

### 1.1 PreviewService

负责 HTML 文件的本地 HTTP 预览、WebSocket 热更新及会话管理。

```typescript
interface PreviewOptions {
  port?: number;          // 指定端口，默认 0（系统分配）
  open?: boolean;         // 是否自动打开浏览器，默认 true
  watch?: boolean;        // 是否监听文件变更，默认 true
}

interface PreviewSession {
  sessionId: string;      // UUID v4
  url: string;            // 完整预览 URL
  port: number;           // 实际监听端口
  filePath: string;       // 源文件绝对路径
  versionId: string;      // 初始版本 ID
  createdAt: string;      // ISO 8601
}

interface PreviewService {
  /**
   * 启动预览会话
   * - 校验 filePath 存在且为 .html/.htm 文件
   * - 启动 HTTP Server + WebSocket
   * - 创建初始版本（v1）
   * - 返回会话信息
   */
  start(filePath: string, options?: PreviewOptions): Promise<PreviewSession>;

  /**
   * 停止预览会话
   * - 关闭 HTTP Server 和 WebSocket
   * - 清理 chokidar watcher
   * - 不删除版本数据
   */
  stop(sessionId: string): Promise<void>;

  /**
   * 强制刷新预览
   * - 重新读取当前版本 HTML
   * - 通过 WebSocket 推送 reload 指令
   */
  refresh(sessionId: string): Promise<void>;

  /**
   * 获取活跃会话信息
   */
  getSession(sessionId: string): PreviewSession | null;

  /**
   * 列出所有活跃会话
   */
  listSessions(): PreviewSession[];
}
```

**错误码**：

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| `PREVIEW_FILE_NOT_FOUND` | 文件不存在 | filePath 无效 |
| `PREVIEW_INVALID_FORMAT` | 文件格式不支持 | 非 .html/.htm 扩展名 |
| `PREVIEW_PORT_CONFLICT` | 端口冲突 | 指定端口已被占用 |
| `PREVIEW_SESSION_NOT_FOUND` | 会话不存在 | sessionId 无效或已关闭 |
| `PREVIEW_FILE_TOO_LARGE` | 文件过大 | 超过 5MB 限制 |

---

### 1.2 AnnotationService

负责标注数据的 CRUD 操作、格式化导出。标注是版本的不可分割部分，跟随版本 seal 状态。所有标注统一为"标注元素 + 评论"，不区分类型。

```typescript
interface AnnotationFilter {
  status?: 'pending' | 'resolved';  // 可按状态过滤
}

interface AnnotationExportOptions {
  format: 'markdown' | 'json';
  includeScreenshots?: boolean;  // 默认 true
}

interface AnnotationExportResult {
  content: string;               // 导出内容
  format: string;
  annotationCount: number;
}

interface AnnotationService {
  /**
   * 获取指定版本的所有标注
   * - sealed 和 unsealed 版本均可读取
   */
  getAll(versionId: string): Promise<Annotation[]>;

  /**
   * 创建标注
   * - 仅允许在 unsealed 版本上创建
   * - 自动生成 id 和 timestamp
   */
  create(versionId: string, data: Omit<Annotation, 'id' | 'timestamp'>): Promise<Annotation>;

  /**
   * 更新标注
   * - 仅允许修改 comment 字段
   * - sealed 版本上的标注不可修改
   */
  update(annotationId: string, updates: { comment: string }): Promise<Annotation>;

  /**
   * 删除标注
   * - 仅允许删除 unsealed 版本上的标注
   */
  delete(annotationId: string): Promise<void>;

  /**
   * 提交标注（触发推送/写入 + 版本自动 seal）
   * - MCP 模式：通过 notification 推送给 Agent
   * - CLI 模式：写入 .html-editor/annotations/{versionId}.json
   * - 提交后版本自动 seal，标注随之固化
   * - 返回格式化后的标注数据
   */
  submit(versionId: string): Promise<AnnotationExportResult>;

  /**
   * 导出标注为指定格式（只读操作，sealed/unsealed 均可）
   */
  export(versionId: string, options: AnnotationExportOptions): Promise<AnnotationExportResult>;
}
```

**错误码**：

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| `ANNOTATION_VERSION_NOT_FOUND` | 版本不存在 | versionId 无效 |
| `ANNOTATION_NOT_FOUND` | 标注不存在 | annotationId 无效 |
| `ANNOTATION_VERSION_SEALED` | 版本已封存 | 尝试修改 sealed 版本的标注 |
| `ANNOTATION_EMPTY` | 无标注数据 | submit 时无标注 |

---

### 1.3 VersionService

负责版本的创建、检出、对比及 Graph 序列化。

```typescript
interface VersionCreateOptions {
  parentId: string;
  htmlContent: string;
  annotations?: Annotation[];    // 可选继承标注
  metadata?: VersionMetadata;
}

interface VersionMetadata {
  agent?: string;
  promptSummary?: string;
}

interface CheckoutOptions {
  keepAnnotations?: boolean;     // 是否继承标注，默认 false
}

interface VersionDiff {
  additions: number;             // 新增行数
  deletions: number;             // 删除行数
  hunks: DiffHunk[];             // diff 片段
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;               // unified diff 格式
}

interface VersionGraphNode {
  id: string;
  version: string;
  parentId: string | null;
  timestamp: string;
  annotationCount: number;
  metadata?: VersionMetadata;
}

interface VersionGraph {
  nodes: VersionGraphNode[];
  edges: Array<{ from: string; to: string }>;
  rootId: string;
  currentId: string;             // 当前预览的版本
}

interface CompareResult {
  diff: VersionDiff;
  annotationsA: Annotation[];
  annotationsB: Annotation[];
}

interface VersionService {
  /**
   * 创建新版本
   * - 生成版本号（基于父版本树形编号）
   * - 保存 HTML 快照为只读文件
   * - 固化关联标注
   * - 返回新版本 ID
   */
  create(options: VersionCreateOptions): Promise<Version>;

  /**
   * 检出版本到 working copy
   * - 将指定版本的 HTML 复制到 working/snapshot.html
   * - 根据 keepAnnotations 决定是否继承标注
   * - 触发预览刷新
   */
  checkout(versionId: string, options?: CheckoutOptions): Promise<Version>;

  /**
   * 对比两个版本
   * - 生成 HTML diff（unified format）
   * - 返回两个版本各自的标注
   */
  compare(versionIdA: string, versionIdB: string): Promise<CompareResult>;

  /**
   * 获取版本历史 Graph
   * - 返回完整的版本树结构
   * - 包含节点信息和边关系
   */
  history(sessionId: string): Promise<VersionGraph>;

  /**
   * 获取单个版本详情
   */
  get(versionId: string): Promise<Version | null>;

  /**
   * 获取当前 working copy 版本
   */
  getWorking(sessionId: string): Promise<Version>;
}
```

**错误码**：

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| `VERSION_NOT_FOUND` | 版本不存在 | versionId 无效 |
| `VERSION_PARENT_NOT_FOUND` | 父版本不存在 | parentId 无效 |
| `VERSION_IMMUTABLE` | 版本不可变 | 尝试修改 sealed 版本 |
| `VERSION_HTML_EMPTY` | HTML 内容为空 | htmlContent 为空字符串 |
| `VERSION_SESSION_NOT_FOUND` | 会话不存在 | sessionId 无效 |

---

### 1.4 PatchService

负责 DOM 定位、diff 计算、patch 应用。

```typescript
interface Patch {
  annotationId: string;
  selector: string;
  action: 'replace' | 'delete' | 'insert_before' | 'insert_after' | 'modify_style';
  content?: string;
  oldContent?: string;            // 校验用，防止误操作
}

interface PatchResult {
  newVersionId: string;
  diff: VersionDiff;
  appliedPatches: number;
  failedPatches: PatchFailure[];
}

interface PatchFailure {
  patch: Patch;
  reason: string;
}

interface PatchPreviewResult {
  previewHtml: string;            // 应用后的 HTML（不持久化）
  diff: VersionDiff;
}

interface PatchService {
  /**
   * 应用 patch 数组并创建新版本
   * - 按顺序依次应用每个 patch
   * - 定位失败时记录 PatchFailure 并跳过
   * - 所有 patch 应用后创建新版本
   * - 部分失败时仍创建版本（记录失败项）
   */
  apply(versionId: string, patches: Patch[]): Promise<PatchResult>;

  /**
   * 预览 patch 效果（不持久化）
   * - 在内存中应用 patch
   * - 返回预览 HTML 和 diff
   */
  preview(versionId: string, patches: Patch[]): Promise<PatchPreviewResult>;
}
```

**DOM 定位策略**：

由于每个版本的 HTML 是静态不可变的快照（sealed 后不会变化），CSS Selector 在同一版本内永远有效，无需 fallback 机制。

```
定位流程:
1. CSS Selector 精确匹配 → 成功则应用
2. CSS Selector 失败 → 记录为 PatchFailure，跳过该 patch
```

**错误码**：

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| `PATCH_VERSION_NOT_FOUND` | 版本不存在 | versionId 无效 |
| `PATCH_EMPTY` | patch 数组为空 | patches 长度为 0 |
| `PATCH_ALL_FAILED` | 所有 patch 均失败 | 无一成功应用 |
| `PATCH_CONTENT_MISMATCH` | 内容校验失败 | oldContent 与实际不匹配 |
| `PATCH_INVALID_ACTION` | 操作类型无效 | action 不在支持范围内 |

---

### 1.5 SnapshotService

负责 DOM 快照采集和 hit-test 计算。

```typescript
interface DOMSnapshot {
  html: string;                   // 序列化 HTML
  tree: DOMTreeNode;              // 简化的 DOM 树结构
}

interface DOMTreeNode {
  tag: string;
  selector: string;
  attributes: Record<string, string>;
  textContent?: string;           // 截断到 100 字符
  children: DOMTreeNode[];
  boundingRect?: DOMRect;
}

interface HitTestOptions {
  bounds: { x: number; y: number; width: number; height: number };
  threshold?: number;             // 交集面积阈值（0-1），默认 0.3
}

interface HitTestResult {
  elements: HitElement[];
  screenshotBase64?: string;      // 区域截图
}

interface SnapshotService {
  /**
   * 获取 DOM 快照
   * - 无 selector 时返回完整文档
   * - 有 selector 时返回匹配元素子树
   */
  get(versionId: string, selector?: string): Promise<DOMSnapshot>;

  /**
   * 执行 hit-test
   * - 计算包围盒与页面元素的交集
   * - 返回命中的元素列表
   * - 可选生成区域截图
   */
  hitTest(versionId: string, options: HitTestOptions): Promise<HitTestResult>;
}
```

**错误码**：

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| `SNAPSHOT_VERSION_NOT_FOUND` | 版本不存在 | versionId 无效 |
| `SNAPSHOT_SELECTOR_INVALID` | 选择器无效 | CSS selector 语法错误 |
| `SNAPSHOT_ELEMENT_NOT_FOUND` | 元素不存在 | selector 匹配不到元素 |
| `SNAPSHOT_BOUNDS_INVALID` | 包围盒无效 | width/height ≤ 0 |

---

## 2. Gateway 层接口

### 2.1 MCP Gateway — Tool inputSchema/outputSchema

#### preview_html

```json
{
  "name": "preview_html",
  "description": "启动 HTML 文件的本地预览，创建初始版本",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "HTML 文件的绝对路径或相对于项目根目录的路径"
      },
      "port": {
        "type": "number",
        "description": "指定预览服务端口，默认系统自动分配"
      }
    },
    "required": ["file_path"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "预览页面 URL" },
      "session_id": { "type": "string", "description": "会话 ID" },
      "version_id": { "type": "string", "description": "初始版本 ID" }
    }
  }
}
```

#### get_annotations

```json
{
  "name": "get_annotations",
  "description": "获取指定版本的标注数据",
  "inputSchema": {
    "type": "object",
    "properties": {
      "version_id": { "type": "string", "description": "版本 ID" },
    },
    "required": ["version_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "annotations": {
        "type": "array",
        "items": { "$ref": "#/definitions/Annotation" }
      },
      "version": { "type": "string" }
    }
  }
}
```

#### apply_patch

```json
{
  "name": "apply_patch",
  "description": "对指定版本应用 DOM patch，生成新版本",
  "inputSchema": {
    "type": "object",
    "properties": {
      "version_id": { "type": "string", "description": "基于哪个版本应用 patch" },
      "patches": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "annotation_id": { "type": "string" },
            "selector": { "type": "string", "description": "CSS selector 定位目标" },
            "action": {
              "type": "string",
              "enum": ["replace", "delete", "insert_before", "insert_after", "modify_style"]
            },
            "content": { "type": "string", "description": "新内容（delete 时可省略）" },
            "old_content": { "type": "string", "description": "原内容，用于校验" }
          },
          "required": ["annotation_id", "selector", "action"]
        }
      }
    },
    "required": ["version_id", "patches"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "new_version_id": { "type": "string" },
      "diff": { "type": "string", "description": "unified diff 文本" },
      "applied_count": { "type": "number" },
      "failed_patches": { "type": "array" }
    }
  }
}
```

#### get_dom_snapshot

```json
{
  "name": "get_dom_snapshot",
  "description": "获取指定版本的 DOM 快照",
  "inputSchema": {
    "type": "object",
    "properties": {
      "version_id": { "type": "string" },
      "selector": { "type": "string", "description": "可选，指定子树根节点" }
    },
    "required": ["version_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "html": { "type": "string" },
      "tree": { "$ref": "#/definitions/DOMTreeNode" }
    }
  }
}
```

#### get_version_history

```json
{
  "name": "get_version_history",
  "description": "获取会话的完整版本历史 Graph",
  "inputSchema": {
    "type": "object",
    "properties": {
      "session_id": { "type": "string" }
    },
    "required": ["session_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "versions": { "type": "array", "items": { "$ref": "#/definitions/VersionGraphNode" } },
      "graph": { "$ref": "#/definitions/VersionGraph" }
    }
  }
}
```

#### checkout_version

```json
{
  "name": "checkout_version",
  "description": "检出历史版本到 working copy",
  "inputSchema": {
    "type": "object",
    "properties": {
      "version_id": { "type": "string" },
      "keep_annotations": { "type": "boolean", "default": false }
    },
    "required": ["version_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "working_version_id": { "type": "string" }
    }
  }
}
```

#### create_version

```json
{
  "name": "create_version",
  "description": "基于父版本创建新版本",
  "inputSchema": {
    "type": "object",
    "properties": {
      "parent_id": { "type": "string" },
      "html_content": { "type": "string", "description": "新版本的完整 HTML" },
      "annotations": { "type": "array", "description": "可选继承的标注" }
    },
    "required": ["parent_id", "html_content"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "version_id": { "type": "string" }
    }
  }
}
```

#### compare_versions

```json
{
  "name": "compare_versions",
  "description": "对比两个版本的 HTML 差异和标注",
  "inputSchema": {
    "type": "object",
    "properties": {
      "version_a": { "type": "string" },
      "version_b": { "type": "string" }
    },
    "required": ["version_a", "version_b"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "diff": { "type": "string" },
      "annotations_a": { "type": "array" },
      "annotations_b": { "type": "array" }
    }
  }
}
```

#### close_preview

```json
{
  "name": "close_preview",
  "description": "关闭预览会话",
  "inputSchema": {
    "type": "object",
    "properties": {
      "session_id": { "type": "string" }
    },
    "required": ["session_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" }
    }
  }
}
```

#### MCP Notification（Server → Agent 推送）

```json
{
  "method": "notifications/annotations_submitted",
  "params": {
    "session_id": "string",
    "version_id": "string",
    "annotations": "Annotation[]",
    "export_markdown": "string"
  }
}
```

---

### 2.2 CLI Gateway — 命令参数定义

所有命令前缀为 `html-editor`，输出格式默认 JSON（`--format json`），可切换为 human-readable（`--format text`）。

#### 全局选项

```
--format <json|text>      输出格式，默认 json
--project-dir <path>      项目根目录，默认 cwd
--quiet                   静默模式，仅输出结果
--verbose                 详细日志
```

#### html-editor preview \<file\>

```
参数:
  file                    HTML 文件路径（必填）

选项:
  --port <number>         指定端口（默认自动分配）
  --no-open               不自动打开浏览器
  --no-watch              不监听文件变更

stdout (JSON):
  { "url": "...", "session_id": "...", "version_id": "..." }

退出码:
  0 - 成功
  1 - 文件不存在或格式错误
  2 - 端口冲突
```

#### html-editor annotations list --version \<v\>

```
选项:
  --version <id>          版本 ID（必填）

stdout (JSON):
  { "annotations": [...], "count": N }
```

#### html-editor annotations export --version \<v\> --out \<file\>

```
选项:
  --version <id>          版本 ID（必填）
  --out <path>            输出文件路径（默认 stdout）
  --format-export <md|json>  导出格式（默认 markdown）
  --no-screenshots        不包含截图 base64

stdout/file:
  导出的标注内容（markdown 或 JSON）
```

#### html-editor patch apply \<file\>

```
参数:
  file                    patch JSON 文件路径（必填），或使用 stdin

选项:
  --version <id>          基于哪个版本应用
  --dry-run               仅预览不持久化

stdin:
  Patch[] JSON 数组

stdout (JSON):
  { "new_version_id": "...", "diff": "...", "applied": N, "failed": [...] }
```

#### html-editor snapshot \<selector\>

```
参数:
  selector                CSS selector（可选，省略则整个文档）

选项:
  --version <id>          版本 ID（必填）
  --tree-only             仅输出树结构，不含完整 HTML

stdout (JSON):
  { "html": "...", "tree": {...} }
```

#### html-editor versions list

```
选项:
  --session <id>          会话 ID（必填）
  --graph                 输出 Graph 结构

stdout (JSON):
  { "versions": [...], "graph": {...} }
```

#### html-editor versions checkout \<version-id\>

```
参数:
  version-id              目标版本 ID（必填）

选项:
  --keep-annotations      继承该版本的标注

stdout (JSON):
  { "working_version_id": "..." }
```

#### html-editor versions create --parent \<v\>

```
选项:
  --parent <id>           父版本 ID（必填）
  --html <path>           HTML 文件路径（必填，或 stdin）
  --inherit-annotations   继承父版本标注

stdin:
  HTML 内容（当 --html 未指定时）

stdout (JSON):
  { "version_id": "..." }
```

#### html-editor versions diff \<v1\> \<v2\>

```
参数:
  v1                      版本 A 的 ID
  v2                      版本 B 的 ID

stdout (JSON):
  { "diff": "...", "additions": N, "deletions": N }

stdout (text):
  unified diff 格式文本
```

### 2.3 同构映射实现约定

- Gateway 层代码**禁止包含业务逻辑**，仅负责：参数解析/校验 → Core Service 调用 → 输出格式化
- MCP Gateway 的每个 tool handler 和 CLI Gateway 的每个 command handler 必须调用**同一个** Core Service 方法
- 新增 Core Service 方法时，必须同时在两个 Gateway 中注册对应入口
- 参数命名约定：MCP 使用 snake_case（`version_id`），CLI 使用 kebab-case（`--version-id`），Core Service 内部使用 camelCase（`versionId`）

---

## 3. 数据流图

### 3.1 预览启动流程

```
用户/Agent
    │
    ▼
[Gateway 入口] ──参数解析──▶ PreviewService.start(filePath, options)
                                    │
                                    ├─▶ 校验文件存在 & 格式 & 大小
                                    │       └─ 失败 → 抛出 PREVIEW_FILE_NOT_FOUND / INVALID_FORMAT / TOO_LARGE
                                    │
                                    ├─▶ 分配端口（检测冲突）
                                    │       └─ 失败 → 抛出 PREVIEW_PORT_CONFLICT
                                    │
                                    ├─▶ 读取 HTML 文件内容
                                    │
                                    ├─▶ VersionService.create({ parentId: null, htmlContent })
                                    │       └─ 创建 v1 版本，写入 .html-editor/versions/v1/snapshot.html
                                    │
                                    ├─▶ 启动 HTTP Server（Express/Fastify）
                                    │       ├─ 路由: GET /preview → 返回预览 HTML 页面壳
                                    │       ├─ 路由: GET /api/snapshot/:versionId → 返回 HTML 内容
                                    │       └─ 路由: 静态资源服务
                                    │
                                    ├─▶ 启动 WebSocket Server
                                    │       └─ 监听客户端连接
                                    │
                                    ├─▶ 启动 chokidar watcher（如果 watch=true）
                                    │       └─ 文件变更 → WebSocket 推送 reload
                                    │
                                    └─▶ 返回 PreviewSession { sessionId, url, port, versionId }
```

### 3.2 标注创建流程（笔迹圈画）

```
用户（浏览器）
    │
    ├─▶ 切换到"圈画模式"（工具栏按钮 / 快捷键 Shift+D）
    │
    ├─▶ mousedown/touchstart → 开始采集笔迹点
    │       └─ 采样频率: 每 16ms 记录一个点（≈60Hz）
    │
    ├─▶ mousemove/touchmove → 实时绘制临时 SVG path
    │       ├─ 原始点 → Catmull-Rom 平滑插值
    │       └─ 渲染到 Canvas 标注绘制层（仅绘制过程中可见）
    │
    ├─▶ mouseup/touchend → 笔迹完成
    │       │
    │       ├─▶ [截图采集]
    │       │       ├─ 计算笔迹包围盒 (bounds)
    │       │       ├─ 扩展包围盒（四周 +20px padding）
    │       │       ├─ html2canvas 渲染区域 → Canvas
    │       │       ├─ Canvas.toDataURL('image/png') → base64
    │       │       └─ 压缩：限制最大 800x600，质量 0.8
    │       │
    │       ├─▶ [hit-test]
    │       │       ├─ 遍历包围盒内的采样网格点（每 10px 一个）
    │       │       ├─ document.elementsFromPoint(x, y) 收集命中元素
    │       │       ├─ 去重 + 过滤（排除 overlay 层自身元素）
    │       │       ├─ 计算元素 boundingRect 与笔迹 bounds 的交集面积比
    │       │       ├─ 过滤 threshold < 0.3 的元素
    │       │       └─ 生成 HitElement[] 列表
    │       │
    │       ├─▶ [确定锚点 anchor_element]
    │       │       ├─ 从 HitElement[] 中选取主要 DOM 节点
    │       │       ├─ 选取策略：面积最大的命中元素 / DOM 最浅层的容器节点
    │       │       └─ 生成 DOMPosition 作为 anchor_element
    │       │
    │       ├─▶ [清除笔迹]
    │       │       └─ 临时 SVG path 从画布移除（笔迹不持久化）
    │       │
    │       └─▶ [弹出评论框]
    │               ├─ 定位在笔迹包围盒右侧/下方
    │               ├─ 用户输入评论文本
    │               └─ 确认 → 组装 InkAnnotation 对象
    │
    ├─▶ [放置锚点标记]
    │       └─ 在 anchor_element 位置显示锚点图标（📌或自定义 SVG icon）
    │
    └─▶ WebSocket 发送 → 后端 AnnotationService.create()
            └─ 存储到 working/annotations.json
```

### 3.3 标注提交流程

```
用户点击"发送给 Agent"按钮
    │
    ▼
[前端] 收集当前版本所有标注
    │
    ├─▶ 校验：至少有 1 条标注，否则按钮 disabled
    │
    ▼
WebSocket 发送 submit 请求
    │
    ▼
[后端] AnnotationService.submit(versionId)
    │
    ├─▶ 读取 working/annotations.json 中的标注
    │
    ├─▶ 格式化为 Markdown 导出格式
    │       └─ 包含：截图 base64、hit_elements 摘要、用户评论
    │
    ├─▶ [MCP Gateway 模式]
    │       ├─ 通过 MCP Server 发送 notification
    │       │   method: "notifications/annotations_submitted"
    │       │   params: { session_id, version_id, annotations, export_markdown }
    │       └─ Agent 收到后自动处理
    │
    ├─▶ [CLI Gateway 模式]
    │       ├─ 写入 .html-editor/annotations/{versionId}.json
    │       ├─ 同时生成 .html-editor/annotations/{versionId}.md（人类可读）
    │       └─ 输出提示：标注已保存，请通知 Agent 读取
    │
    └─▶ 更新按钮状态为"已提交"
```

### 3.4 版本创建流程（patch 应用）

```
Agent 调用 apply_patch
    │
    ▼
[Gateway] 解析参数 → PatchService.apply(versionId, patches)
    │
    ├─▶ VersionService.get(versionId) → 获取基础 HTML
    │       └─ 失败 → 抛出 PATCH_VERSION_NOT_FOUND
    │
    ├─▶ 解析 HTML 为 DOM 树（使用 cheerio / jsdom）
    │
    ├─▶ 按顺序应用每个 Patch:
    │       │
    │       ├─▶ [定位目标元素]
    │       │       ├─ CSS Selector 匹配
    │       │       │       └─ 成功 → 使用该元素
    │       │       └─ 失败 → 记录 PatchFailure，跳过
    │       │
    │       ├─▶ [校验 oldContent]（如果提供）
    │       │       └─ 不匹配 → 记录 PATCH_CONTENT_MISMATCH，跳过
    │       │
    │       └─▶ [执行操作]
    │               ├─ replace: 替换元素内容/outerHTML
    │               ├─ delete: 移除元素
    │               ├─ insert_before: 在元素前插入
    │               ├─ insert_after: 在元素后插入
    │               └─ modify_style: 修改 style 属性
    │
    ├─▶ 序列化修改后的 DOM → HTML 字符串
    │
    ├─▶ VersionService.create({ parentId: versionId, htmlContent: newHtml })
    │       └─ 生成新版本号、保存快照
    │
    ├─▶ 计算 diff（原 HTML vs 新 HTML）
    │
    ├─▶ 通知 PreviewService 切换到新版本
    │       └─ WebSocket 推送 version_changed 事件 → 前端刷新 iframe
    │
    └─▶ 返回 PatchResult { newVersionId, diff, appliedPatches, failedPatches }
```

### 3.5 版本 checkout 流程

```
用户/Agent 请求 checkout
    │
    ▼
[Gateway] → VersionService.checkout(versionId, options)
    │
    ├─▶ VersionService.get(versionId) → 获取目标版本
    │       └─ 失败 → 抛出 VERSION_NOT_FOUND
    │
    ├─▶ 读取 versions/{versionId}/snapshot.html
    │
    ├─▶ 写入 working/snapshot.html（覆盖当前工作副本）
    │
    ├─▶ 处理标注:
    │       ├─ keepAnnotations=true → 复制 versions/{versionId}/annotations.json → working/annotations.json
    │       └─ keepAnnotations=false → 创建空 working/annotations.json
    │
    ├─▶ 更新 working/meta.json { parentId: versionId, checkedOutFrom: versionId }
    │
    ├─▶ 通知 PreviewService 刷新
    │       └─ WebSocket 推送 version_changed
    │
    └─▶ 返回 working version 信息
```

---

## 4. 状态机

### 4.1 预览会话状态

```
                    start()
     ┌──────────────────────────────┐
     ▼                              │
  [idle] ──── preview_html ────▶ [previewing]
                                    │       ▲
                                    │       │ submit 完成 / 取消标注
                                    ▼       │
                              [annotating] ──┘
                                    │
                                    │ 点击"发送给 Agent"
                                    ▼
                              [submitting]
                                    │
                                    ├─ 成功 → [previewing]
                                    └─ 失败 → [annotating]（保留标注数据重试）

  任何状态 ── close_preview ──▶ [idle]
```

**状态描述**：

| 状态 | 含义 | 允许的操作 |
|------|------|-----------|
| `idle` | 无活跃预览 | start |
| `previewing` | 预览中，可浏览和查看 | 标注、checkout、close |
| `annotating` | 正在创建/编辑标注 | 添加/删除/修改标注、提交、取消 |
| `submitting` | 标注提交中（发送给 Agent） | 等待完成 |

### 4.2 版本状态

```
  [unsealed] ──── submit / apply_patch ────▶ [sealed]
     │                                        │
     │  （仅 working copy 处于 unsealed）       │  （不可变，只读）
     │                                        │
     └──── checkout ◀─────────────────────────┘
              │
              ▼
        新的 [unsealed]（working copy）
```

**状态描述**：

| 状态 | 含义 | 数据可变性 |
|------|------|----------|
| `unsealed` | 工作副本，用户当前编辑中 | HTML 和标注均可修改 |
| `sealed` | 已封存版本，不可变 | 只读，不允许任何修改 |

**约束**：
- 系统中同一时刻只有一个 `unsealed` 版本（即 working copy）
- `sealed` 版本永远不可退回 `unsealed`
- checkout 操作会将目标版本的快照复制到新的 `unsealed` working copy
- 标注是版本的不可分割部分，跟随版本 seal 状态

---

## 5. 前端标注 UI 规范

### 5.1 标注 Overlay 分层架构

```
┌─────────────────────────────────────────┐  z-index: 10000
│  工具栏层 (Toolbar Layer)                │  ← 固定定位，顶部/侧边
├─────────────────────────────────────────┤  z-index: 9000
│  标注绘制层 (Drawing Layer)              │  ← Canvas/SVG，绘制笔迹和标注标记
├─────────────────────────────────────────┤  z-index: 8000
│  交互捕获层 (Interaction Layer)          │  ← 透明 div，捕获鼠标/触控事件
├─────────────────────────────────────────┤  z-index: 1
│  HTML 渲染层 (Render Layer)              │  ← iframe，渲染用户 HTML
└─────────────────────────────────────────┘
```

**各层职责**：

| 层 | DOM 结构 | pointer-events | 职责 |
|----|----------|---------------|------|
| 工具栏层 | React 组件树 | `auto` | 工具切换、状态显示、操作按钮 |
| 标注绘制层 | `<canvas>` + `<svg>` | `none` | 临时笔迹渲染、锚点标记、高亮标记、标注气泡 |
| 交互捕获层 | `<div>` 全屏覆盖 | `auto`（标注模式）/ `none`（浏览模式） | 事件采集、坐标转换 |
| HTML 渲染层 | `<iframe sandbox>` | `auto`（浏览模式）/ `none`（标注模式） | 渲染用户 HTML |

**模式切换**：
- 浏览模式：交互捕获层 `pointer-events: none`，用户可正常操作 iframe 内容
- 标注模式：交互捕获层 `pointer-events: auto`，截获所有交互事件

### 5.2 笔迹圈画实现规范

**核心设计原则**：笔迹仅作为**临时圈选工具**，完成后立即消失，不持久化存储 SVG path data。原因：浏览器窗口变形后 path 坐标会失真，存储无意义。

**技术选择**：SVG `<path>` 实时临时绘制（仅绘制过程中可见）

**临时渲染规范**：

笔迹仅在绘制过程中实时渲染（Canvas/SVG），完成后清除画布，只保留截图和 hit-test 结果。

| 参数 | 值 | 说明 |
|------|-----|------|
| 采样间隔 | 16ms（requestAnimationFrame） | ≈60 FPS |
| 最小移动距离 | 3px | 小于此距离的点忽略（防抖动） |
| 平滑算法 | Catmull-Rom spline | 控制点为相邻采样点 |
| 张力参数 (tension) | 0.5 | Catmull-Rom 默认张力 |
| 线宽 | 3px | 固定宽度，不随压感变化（V1） |
| 线色 | `#FF4444`（红色） | 可通过工具栏切换 |
| 线透明度 | 0.8 | 半透明以不遮挡内容 |

**SVG path 生成（仅用于实时渲染，不持久化）**：

```
采样点 [P0, P1, P2, ...Pn]
    │
    ├─▶ 起始: M P0.x P0.y
    │
    ├─▶ 对每段 Pi → Pi+1:
    │       计算 Catmull-Rom 控制点 CP1, CP2
    │       生成: C CP1.x CP1.y CP2.x CP2.y Pi+1.x Pi+1.y
    │
    └─▶ 最终 path: "M x0 y0 C ... C ... C ..."
        （仅用于实时 SVG 渲染，笔迹完成后丢弃）
```

**完成后处理流程**：

```
mouseup/touchend 触发:
    │
    ├─▶ 1. 截图采集（在清除笔迹前完成）
    ├─▶ 2. hit-test 计算
    ├─▶ 3. 确定 anchor_element（从 hit-test 结果中选取）
    ├─▶ 4. 清除临时笔迹（从画布移除 SVG path）
    └─▶ 5. 在 anchor_element 位置放置锚点标记
```

**性能约束**：
- 单次笔迹最大采样点数：2000（超出自动结束）
- 最大笔迹持续时间：30 秒（超出自动结束）
- 实时渲染使用 SVG（DOM 更新），笔迹完成后立即清除（不转 Canvas 位图，不保留）

### 5.3 hit-test 算法

**输入**：笔迹包围盒 `bounds: { x, y, width, height }`

**算法步骤**：

```
1. 扩展包围盒（padding: 10px 四周）→ expandedBounds

2. 在 expandedBounds 内生成采样网格
   - 网格步长: 10px
   - 采样点数: ceil(width/10) × ceil(height/10)

3. 对每个采样点 (sx, sy):
   - 调用 document.elementsFromPoint(sx, sy)
   - 收集返回的元素列表

4. 去重合并所有命中元素（按 CSS selector 去重）

5. 过滤:
   - 排除 overlay 层自身元素（data-annotation-layer 属性）
   - 排除 <html>, <head> 等根节点（保留 <body>）
   - 排除不可见元素（display:none, visibility:hidden, opacity:0）

6. 计算交集面积比:
   - 对每个候选元素 E:
     - elementRect = E.getBoundingClientRect()
     - intersection = 计算 elementRect ∩ bounds 的面积
     - ratio = intersection / elementRect 面积
   - 过滤 ratio < threshold (默认 0.3) 的元素

7. 按 DOM 深度排序（深层优先）

8. 兆底处理（hit-test 永远不会返回空结果）:
   - 如果过滤后无元素命中，兆底命中 body 元素
   - 生成 body 的 HitElement 作为结果

9. 生成 HitElement[] 列表:
   - selector: 生成唯一 CSS selector
   - tag: element.tagName
   - outer_html_summary: outerHTML 截断到 200 字符
   - bounding_rect: getBoundingClientRect()

10. 记录 ink_region（圈画区域的视口坐标）:
    - 将笔迹包围盒 bounds 作为 ink_region: { x, y, width, height }
    - 作为元素定位的补充上下文（即使兆底到 body，Agent 也能通过位置信息理解用户圈画的大致区域）
```

### 5.4 截图采集规范

**技术方案**：html2canvas 库

**采集流程**：

| 步骤 | 操作 | 参数 |
|------|------|------|
| 1 | 计算截图区域 | 笔迹 bounds + 20px padding |
| 2 | 隐藏 overlay 层 | 设置 data-annotation-layer 元素 visibility: hidden |
| 3 | 调用 html2canvas | `{ x, y, width, height, scale: 2, useCORS: true }` |
| 4 | 恢复 overlay 层 | 恢复 visibility |
| 5 | Canvas → base64 | `canvas.toDataURL('image/png', 0.8)` |
| 6 | 尺寸限制 | 最大 800×600，超出则等比缩放 |
| 7 | 大小限制 | base64 字符串最大 500KB，超出降低质量 |

**fallback**：若 html2canvas 失败（跨域资源等），使用 Canvas drawImage 截取可见视口区域。

### 5.5 锚点标记交互规范

**锚点标记**是笔迹圈画完成后的持久化视觉元素，代替原先的笔迹 path 展示。

**放置规则**：

| 属性 | 值 | 说明 |
|------|-----|------|
| 图标 | 📌 或自定义 SVG icon | 小尺寸图标，不影响页面布局 |
| 定位方式 | 固定在 anchor_element 的右上角 | 使用 anchor_element 的 boundingRect 计算位置 |
| z-index | 9000（标注绘制层） | 保证可见不被遮挡 |
| 尺寸 | 20×20px | 固定尺寸，不随缩放变化 |
| 动画 | 入场时 scale(0→1) + fade-in | 提示用户新标注已创建 |

**交互行为**：

| 事件 | 行为 |
|------|------|
| hover 锚点 | ① 弹出截图预览浮层（圈画区域截图）；② 关联的 hit_elements DOM 节点添加高亮样式 |
| 离开 hover | 关闭截图预览；移除 DOM 高亮样式 |
| 点击锚点 | 展开标注详情面板（评论、状态、操作按钮） |
| 拖动锚点 | 不支持（V1），锚点位置固定跟随 anchor_element |

**截图预览浮层**：

```
┌───────────────────────┐
│  [screenshot image]    │  ← 最大 400×300 展示
├───────────────────────┤
│  用户评论文本...       │
│  命中元素: 3 个           │
└───────────────────────┘
```

**DOM 高亮样式**：

```css
[data-annotation-highlight] {
  outline: 2px solid #FF4444 !important;
  outline-offset: 2px;
  background-color: rgba(255, 68, 68, 0.1) !important;
  transition: outline 0.2s ease, background-color 0.2s ease;
}
```

### 5.6 标注侧边栏 UI 规范

参考 Plannotator 设计，页面右侧显示当前版本所有标注列表。

**布局**：

| 属性 | 值 | 说明 |
|------|-----|------|
| 位置 | 页面右侧面板 | 可配置为左侧 |
| 宽度 | 300px | 固定宽度 |
| 可折叠 | 是 | 点击折叠按钮收起 |
| z-index | 9500 | 高于绘制层，低于工具栏 |

**列表 Item 显示**：

```
┌────────────────────────────┐
│ 📌 <h1> body > div.hero > h1 │  ← 锚点元素标签摘要
│ 标题颜色改为品牌色       │  ← 评论内容（截断 80 字符）
│ 2026-07-20 10:30     [🗑️]  │  ← 时间戳 + 删除按钮
└────────────────────────────┘
```

**CRUD 操作**：

| 操作 | 触发方式 | 说明 |
|------|----------|------|
| 新增 | 圈画/点选创建 | 自动出现在侧边栏列表 |
| 查看 | hover item | 页面上对应锚点高亮 |
| 编辑 | 点击 item | 展开编辑评论区域 |
| 删除 | 删除按钮 | 移除标注（unsealed 版本） |

**点击 Item 滚动定位**：

```
用户点击侧边栏标注 item
    │
    ├─▶ 1. 获取 anchor_element.selector
    │
    ├─▶ 2. 检查是否需要路由跳转（SPA 场景）
    │       ├─ selector 包含 [data-page="/xxx"] → 先路由跳转
    │       └─ 否则直接滚动
    │
    ├─▶ 3. 在 iframe 内执行 scrollIntoView
    │       document.querySelector(selector).scrollIntoView({ behavior: 'smooth', block: 'center' })
    │
    └─▶ 4. 高亮目标元素 2s 后自动移除高亮
```

**SPA 路由跳转逻辑**：

当页面是 SPA 且标注元素在不同路由页面上时：
1. 从 selector 中解析路由信息（如 `[data-page="/about"]`）
2. 通过 postMessage 通知 iframe 内部进行路由跳转
3. 等待路由跳转完成（监听 iframe 的 load/popstate 事件）
4. 再执行 scrollIntoView 定位到目标元素

**高亮样式**：

```css
[data-sidebar-highlight] {
  outline: 2px solid #1a73e8 !important;
  outline-offset: 2px;
  background-color: rgba(26, 115, 232, 0.08) !important;
  transition: outline 0.3s ease, background-color 0.3s ease;
}
```

---

### 5.7 工具栏 UI 规范

**位置**：预览页面右上角，固定定位，可拖拽移动。

**工具栏结构**：

```
┌─────────────────────────────────────┐
│ [🖱️浏览] [✏️圈画] [📌选择] [💬全局] │  ← 模式切换
├─────────────────────────────────────┤
│ [↩️撤销] [↪️重做] [🗑️清除]          │  ← 操作
├─────────────────────────────────────┤
│ [📤发送给 Agent] (N条待处理)         │  ← 提交
├─────────────────────────────────────┤
│ [📊版本 Graph]                      │  ← 版本面板开关
└─────────────────────────────────────┘
```

**快捷键**：

| 快捷键 | 功能 |
|--------|------|
| `Escape` | 退回浏览模式 |
| `Shift+D` | 切换圈画模式 |
| `Shift+S` | 切换选择模式 |
| `Shift+G` | 添加全局评论 |
| `Ctrl/Cmd+Z` | 撤销 |
| `Ctrl/Cmd+Shift+Z` | 重做 |
| `Ctrl/Cmd+Enter` | 发送给 Agent |

**按钮状态**：

| 按钮 | 条件 | 状态 |
|------|------|------|
| 发送给 Agent | 无标注 | disabled, 灰色 |
| 发送给 Agent | 有未提交标注 | enabled, 高亮蓝色 + badge 数字 |
| 发送给 Agent | 提交中 | loading spinner |
| 发送给 Agent | 提交成功 | 绿色 ✓，2s 后恢复 |

---

## 6. 版本管理规范

### 6.1 版本号算法

**规则**：树形编号，格式为 `v{major}[.{branch}[.{sub}...]]`

**生成规则**：

```
给定父版本号 parentVersion 和已有子版本列表 existingChildren:

1. 如果 parentVersion 为 null（根版本）:
   → 版本号 = "v1"

2. 如果父版本没有子版本:
   → 版本号 = parentVersion + ".1"
   → 例: 父 "v1" → 子 "v1.1"

3. 如果父版本已有子版本:
   → 取最大子序号 + 1
   → 例: 父 "v1" 已有 "v1.1", "v1.2" → 新子 "v1.3"

4. 深层嵌套示例:
   v1 → v1.1 → v1.1.1
              → v1.1.2
        v1.2 → v1.2.1
```

**版本号解析**：

```typescript
interface ParsedVersion {
  segments: number[];   // [1, 2, 1] 对应 "v1.2.1"
  depth: number;        // 树深度
  parent: string;       // 父版本号字符串
}

// 排序规则：按段逐级比较，同级按序号升序
// v1 < v1.1 < v1.1.1 < v1.2 < v2
```

### 6.2 版本存储结构

```
.html-editor/
├── config.json                    # 全局配置
├── sessions/
│   └── {sessionId}.json           # 会话元数据
├── versions/
│   ├── index.json                 # 版本索引（Graph 结构）
│   ├── {versionId}/
│   │   ├── snapshot.html          # HTML 快照（只读）
│   │   ├── annotations.json      # 标注数据（只读）
│   │   └── meta.json             # 版本元数据
│   └── ...
├── working/                       # 当前工作副本（可修改）
│   ├── snapshot.html
│   ├── annotations.json
│   └── meta.json                  # { parentId, checkedOutFrom, createdAt }
└── annotations/                   # CLI Gateway 导出目录
    ├── {versionId}.json           # 结构化标注
    └── {versionId}.md             # Markdown 格式标注
```

**index.json 结构**：

```typescript
interface VersionIndex {
  rootId: string;
  versions: Record<string, {
    id: string;
    version: string;           // 版本号 "v1.1"
    parentId: string | null;
    childIds: string[];
    timestamp: string;
    annotationCount: number;
    htmlSize: number;          // 快照文件大小（字节）
  }>;
}
```

**meta.json 结构**：

```typescript
interface VersionMeta {
  id: string;
  version: string;
  parentId: string | null;
  timestamp: string;
  metadata?: VersionMetadata;
  checksum: string;            // HTML 快照的 SHA-256
}
```

### 6.3 Version Graph 序列化格式

用于版本 Graph UI 渲染和 MCP/CLI 输出：

```typescript
interface SerializedGraph {
  format: "html-editor-version-graph-v1";
  generated_at: string;         // ISO 8601
  session_id: string;
  root_id: string;
  current_id: string;           // 当前预览的版本
  nodes: Array<{
    id: string;
    version: string;
    parent_id: string | null;
    child_ids: string[];
    timestamp: string;
    annotation_count: number;
    metadata?: VersionMetadata;
  }>;
  edges: Array<{
    from: string;               // parent id
    to: string;                 // child id
  }>;
  stats: {
    total_versions: number;
    max_depth: number;
    branch_count: number;
  };
}
```

### 6.4 版本对比算法

**HTML diff 策略**：

| 步骤 | 方法 | 说明 |
|------|------|------|
| 1 | HTML 格式化 | 用 prettier 统一缩进和换行，消除格式差异 |
| 2 | 行级 diff | 使用 diff-match-patch 的 line diff 模式 |
| 3 | 输出格式 | unified diff（类似 git diff） |
| 4 | 语义优化 | diff-match-patch 的 `diff_cleanupSemantic` 合并零散差异 |

**对比结果结构**：

```typescript
interface VersionCompareResult {
  versionA: { id: string; version: string };
  versionB: { id: string; version: string };
  diff: {
    unified: string;           // unified diff 文本
    additions: number;
    deletions: number;
    hunks: DiffHunk[];
  };
  annotationsA: Annotation[];
  annotationsB: Annotation[];
  summary: string;             // 人类可读的变更摘要
}
```

---

## 7. 配置项

### 7.1 配置文件

位置：`.html-editor/config.json`

```typescript
interface Config {
  // 服务配置
  server: {
    port: number;              // 默认: 0（自动分配）
    host: string;              // 默认: "localhost"
    open_browser: boolean;     // 默认: true
  };

  // 预览配置
  preview: {
    watch: boolean;            // 默认: true
    max_file_size: number;     // 默认: 5242880（5MB，字节）
    allowed_extensions: string[];  // 默认: [".html", ".htm"]
  };

  // 标注配置
  annotation: {
    persist: boolean;          // 默认: true
    max_screenshot_size: number;  // 默认: 512000（500KB）
    screenshot_quality: number;   // 默认: 0.8
    screenshot_max_width: number; // 默认: 800
    screenshot_max_height: number;// 默认: 600
  };

  // 版本配置
  version: {
    max_versions: number;      // 默认: 200（单会话最大版本数）
    auto_cleanup: boolean;     // 默认: false
    cleanup_keep_latest: number;  // 默认: 50
  };

  // 笔迹配置
  ink: {
    sampling_interval: number; // 默认: 16（ms）
    min_move_distance: number; // 默认: 3（px）
    max_points: number;        // 默认: 2000
    max_duration: number;      // 默认: 30000（ms）
    stroke_width: number;      // 默认: 3（px）
    stroke_color: string;      // 默认: "#FF4444"
    stroke_opacity: number;    // 默认: 0.8
    smoothing: "catmull-rom" | "none";  // 默认: "catmull-rom"
    tension: number;           // 默认: 0.5
  };

  // hit-test 配置
  hit_test: {
    grid_step: number;         // 默认: 10（px）
    threshold: number;         // 默认: 0.3
    padding: number;           // 默认: 10（px）
  };

  // 功能开关
  features: {
    enable_remote_preview: boolean;    // 默认: false
    enable_auto_apply: boolean;        // 默认: false
    enable_ink_annotation: boolean;    // 默认: true
    enable_version_graph: boolean;     // 默认: true
    enable_mcp_push: boolean;          // 默认: true
  };
}
```

### 7.2 环境变量映射

| 环境变量 | 配置项 | 类型 | 说明 |
|----------|--------|------|------|
| `HTML_EDITOR_PORT` | server.port | number | 服务端口 |
| `HTML_EDITOR_HOST` | server.host | string | 监听地址 |
| `HTML_EDITOR_NO_OPEN` | server.open_browser | boolean(反转) | 设置时不打开浏览器 |
| `HTML_EDITOR_MAX_FILE_SIZE` | preview.max_file_size | number | 最大文件大小（字节） |
| `HTML_EDITOR_NO_WATCH` | preview.watch | boolean(反转) | 设置时不监听文件 |
| `HTML_EDITOR_NO_PERSIST` | annotation.persist | boolean(反转) | 设置时不持久化标注 |
| `ENABLE_REMOTE_PREVIEW` | features.enable_remote_preview | boolean | 远程预览开关 |
| `ENABLE_AUTO_APPLY` | features.enable_auto_apply | boolean | 自动应用开关 |
| `ENABLE_INK_ANNOTATION` | features.enable_ink_annotation | boolean | 笔迹圈画开关 |
| `ENABLE_VERSION_GRAPH` | features.enable_version_graph | boolean | 版本 Graph 开关 |

**优先级**：环境变量 > config.json > 默认值

---

## 8. 异常分支

### 8.1 错误分类体系

```typescript
// 错误基类
interface HtmlEditorError {
  code: string;            // 机器可读错误码
  message: string;         // 人类可读描述
  module: 'preview' | 'annotation' | 'version' | 'patch' | 'snapshot';
  severity: 'fatal' | 'error' | 'warning';
  recoverable: boolean;
  context?: Record<string, unknown>;
}
```

### 8.2 各模块异常处理策略

#### PreviewService 异常

| 场景 | 错误码 | 严重度 | 处理策略 |
|------|--------|--------|----------|
| 文件不存在 | PREVIEW_FILE_NOT_FOUND | fatal | 立即返回错误，提示用户检查路径 |
| 文件格式错误 | PREVIEW_INVALID_FORMAT | fatal | 返回错误，列出支持的格式 |
| 文件过大 | PREVIEW_FILE_TOO_LARGE | error | 返回错误，提示限制和当前大小 |
| 端口冲突 | PREVIEW_PORT_CONFLICT | warning | 自动重试下一端口（最多 10 次） |
| 文件变更时读取失败 | PREVIEW_WATCH_ERROR | warning | 记录日志，等待下次变更 |
| WebSocket 连接断开 | PREVIEW_WS_DISCONNECTED | warning | 前端自动重连（指数退避，最大 30s） |

#### PatchService 异常 — DOM 定位

由于每个版本的 HTML 是静态不可变的快照，CSS Selector 在同一版本内永远有效。PatchService 仅使用 CSS Selector 直接定位，失败时记录为 PatchFailure 并跳过。

```
┌─────────────────────────────────────────────────────────────┐
│                    DOM 定位策略                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CSS Selector 匹配                                            │
│    document.querySelector(selector)                          │
│    ├─ 匹配到 → 校验 oldContent → 应用 patch                  │
│    └─ 未匹配 → 记录 PatchFailure，跳过该 patch             │
│                                                              │
│  说明：版本 HTML 是静态快照，sealed 后 DOM 结构不会变化，   │
│  因此 CSS Selector 永远有效，无需 fallback 机制。        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### MCP 连接异常

| 场景 | 处理策略 |
|------|----------|
| MCP Server 启动失败 | 检查端口/依赖，输出诊断信息到 stderr |
| Agent 断开连接 | 保持 preview 运行，标注可继续，推送队列暂存 |
| Notification 发送失败 | 队列暂存（最多 10 条），重连后重发 |
| Agent 重新连接 | 自动重发暂存的 notification |
| JSON-RPC 解析失败 | 返回标准 JSON-RPC error，记录日志 |

#### 版本管理异常

| 场景 | 处理策略 |
|------|----------|
| 版本数超限 | 提示用户清理，不阻塞创建 |
| 版本文件损坏 | 标记该版本为 `corrupted`，跳过，不影响其他版本 |
| index.json 损坏 | 从各版本 meta.json 重建索引 |
| 磁盘空间不足 | 返回 fatal 错误，提示释放空间 |

### 8.3 前端异常处理

| 场景 | 处理策略 |
|------|----------|
| WebSocket 断开 | 显示顶部黄色 banner "连接已断开，正在重连..."，指数退避重试 |
| html2canvas 失败 | fallback 到空截图，标注仍可提交（无截图） |
| hit-test 超时（>2s） | 中止计算，使用已收集的部分结果 |
| iframe 加载失败 | 显示错误提示面板，提供"重试"按钮 |
| 标注数据同步失败 | 本地 localStorage 缓存，重连后同步 |

---

## 9. 安全性

### 9.1 iframe sandbox 策略

```html
<iframe
  sandbox="allow-scripts allow-same-origin"
  referrerpolicy="no-referrer"
  csp="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; img-src *;"
></iframe>
```

**sandbox 属性说明**：

| 属性 | 是否启用 | 理由 |
|------|----------|------|
| `allow-scripts` | ✅ | 用户 HTML 可能包含 JS |
| `allow-same-origin` | ✅ | 允许加载外部 CDN 资源 |
| `allow-forms` | ❌ | 防止表单提交到外部 |
| `allow-popups` | ❌ | 防止打开新窗口 |
| `allow-top-navigation` | ❌ | 防止劫持顶层页面 |
| `allow-downloads` | ❌ | 防止自动下载 |

**额外安全措施**：
- iframe 内注入的 overlay 脚本通过 `postMessage` 与父窗口通信，不直接访问父窗口 DOM
- 限制 postMessage 的 origin 校验为 `localhost`

### 9.2 文件路径访问限制

**路径白名单规则**：

```typescript
interface PathPolicy {
  // 允许预览的文件必须满足:
  allowedRoots: string[];      // 默认: [process.cwd()]（项目根目录）
  allowedExtensions: string[]; // [".html", ".htm"]
  denyPatterns: string[];      // ["**/node_modules/**", "**/.git/**", "**/.*"]

  // .html-editor/ 目录的访问规则:
  dataDir: string;             // 固定为 {projectRoot}/.html-editor/
  // 仅允许该目录下的读写，禁止向上遍历
}
```

**校验流程**：
1. resolve 为绝对路径
2. 检查是否在 allowedRoots 下（防止 `../` 遍历）
3. 检查扩展名是否在白名单中
4. 检查是否命中 denyPatterns
5. 检查文件大小是否超限

### 9.3 标注数据隐私边界

| 数据类型 | 隐私级别 | 存储位置 | 传输方式 |
|----------|----------|----------|----------|
| 标注评论文本 | 低 | 本地磁盘 | MCP notification / 文件 |
| DOM 快照 HTML | 中 | 本地磁盘 | MCP response / 文件 |
| 截图 base64 | 中 | 本地磁盘 | MCP notification / 文件 |
| 锚点定位数据 | 低 | 本地磁盘 | MCP notification / 文件 |
| 源 HTML 文件 | 高 | 原始位置（只读） | 仅本地 HTTP 服务 |

**隐私保护措施**：
- 所有数据仅存储在本地项目目录，不上传到外部服务器
- MCP 通信仅通过 stdio（本地进程间通信），不经过网络
- HTTP 预览服务仅监听 localhost，不对外暴露
- 截图数据限制大小（500KB），自动压缩
- `html-editor close` 时可选清除所有临时数据（`--cleanup` 参数）

---

## 附录 A: 类型定义汇总

```typescript
// DOM 定位
interface DOMPosition {
  selector: string;           // CSS Selector（版本内永远有效）
  textOffset?: { start: number; end: number }; // 文本内偏移（可选）
}

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

// 完整 Version 类型
interface Version {
  id: string;
  version: string;
  parentId: string | null;
  htmlContent: string;         // HTML 快照内容
  annotations: Annotation[];   // 版本上的标注（不可分割部分）
  sealed: boolean;             // 是否已封存
  timestamp: string;
  metadata?: VersionMetadata;
}

// HitElement
interface HitElement {
  selector: string;
  tag: string;
  outerHtmlSummary: string;
  boundingRect: { x: number; y: number; width: number; height: number };
}
```

---

## 附录 B: 目录结构总览

```
html-editor-plugin/
├── src/
│   ├── core/                        # Core Service 层
│   │   ├── preview.service.ts       # PreviewService 实现
│   │   ├── annotation.service.ts    # AnnotationService 实现
│   │   ├── version.service.ts       # VersionService 实现
│   │   ├── patch.service.ts         # PatchService 实现
│   │   ├── snapshot.service.ts      # SnapshotService 实现
│   │   ├── types.ts                 # 共享类型定义
│   │   ├── errors.ts                # 错误码定义
│   │   └── config.ts                # 配置加载与合并
│   ├── gateway/
│   │   ├── mcp/
│   │   │   ├── index.ts             # MCP Server 入口
│   │   │   ├── tools.ts             # Tool 注册
│   │   │   └── notifications.ts     # Notification 推送
│   │   └── cli/
│   │       ├── index.ts             # CLI 入口
│   │       ├── commands/            # 各命令实现
│   │       └── output.ts            # 格式化输出
│   └── ui/
│       ├── overlay/                 # 标注 Overlay
│       │   ├── InteractionLayer.tsx
│       │   ├── DrawingLayer.tsx
│       │   └── ToolbarLayer.tsx
│       ├── version-graph/           # 版本 Graph UI
│       └── toolbar/                 # 工具栏组件
├── dist/                            # 构建产物
├── .html-editor/                    # 运行时数据（gitignore）
├── skills/                          # Skill 定义
├── hooks/                           # Hook 配置
├── .mcp.json                        # MCP 配置
├── plugin.json                      # 插件元数据
├── tsconfig.json
└── package.json
```
