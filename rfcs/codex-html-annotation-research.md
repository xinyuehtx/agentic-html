# Codex HTML 批注评论能力调研报告

**调研时间**: 2026年7月  
**调研范围**: OpenAI Codex、Claude Code、Cursor 等 AI 编程代理的 HTML 批注能力  
**报告目的**: 了解竞品方案、分析技术架构、识别 agentic-html 的改进机会

---

## 执行摘要

Codex、Claude Code 等主流 AI 编程代理已广泛支持 **HTML 预览 + 批注评论** 的工作流。与 agentic-html 相比，这些方案：

1. **交互方式更轻量**: 基于点选/圈画触发批注，支持批量提交
2. **集成深度更深**: 直接与 Agent thread 集成，批注自动成为 chat input
3. **版本管理不同**: 多数方案未提供显式版本控制，而是基于单一工作流迭代
4. **技术栈相似**: 都采用浏览器内嵌、WebSocket 实时通信、DOM 定位等技术

**主要发现**: agentic-html 的 **版本化批注 + Graph 管理** 是独特优势，但在 **交互轻量性** 和 **Agent 集成** 方面有改进空间。

---

## 1. Codex HTML 批注功能概述

### 1.1 功能定位

Codex 在 2026 年 4 月发布的重大更新中，引入了**内置浏览器**和**计算机使用能力**：

- **内置浏览器** (Built-in Browser): 嵌入 Codex 桌面应用，支持加载本地开发服务器或远程网页
- **批注模式** (Annotation Mode): 用户可对浏览器中的页面元素进行点选/圈画，留下可视化反馈
- **自动交互** (Computer Use): Agent 可自动操作浏览器（点击、输入、截图），实现自动化反馈闭环

### 1.2 交互流程

**标注步骤**:
1. 在 Codex 中打开内置浏览器，加载本地应用或远程页面
2. 点击浏览器右上角 "Annotations" 按钮，进入 Annotation Mode
3. 用户可以：
   - **点选元素**: 单击页面元素，自动触发批注输入框
   - **圈画区域**: 拖拽划出矩形区域，框选需要修改的部分
4. 在批注框内输入反馈文本（如："the button overflows on mobile"）
5. 按 Enter 或点击箭头按钮提交批注

**提交方式**:
- **即时提交**: Enter 键立即发送单个批注
- **批量提交**: 可先添加多个批注，然后统一点击 "Make these changes" 处理

### 1.3 Agent 反馈闭环

```
用户在 Codex 浏览器中批注
        ↓
批注作为聊天消息发送到 Agent thread
        ↓
Agent 接收批注 + 页面截图上下文
        ↓
Agent 更新源代码（HTML/CSS）
        ↓
本地开发服务器热更新
        ↓
浏览器自动刷新预览
        ↓
用户验证修改效果
```

---

## 2. Claude Code HTML 预览与批注

### 2.1 功能架构

Claude Code 桌面版（2026 年 2 月发布）引入了 **Preview 面板**：

- **预览启动**: 自动启动本地开发服务器，iframe 嵌入运行中的应用
- **实时反馈**: Claude 自动截图、检查 DOM、点击元素、填充表单以进行自我验证
- **可视化批注**: 用户可在预览面板中选择 UI 元素，直接向 Claude 传递可视化反馈

### 2.2 工作流特点

**与 Codex 的对比**:

| 特性 | Codex | Claude Code |
|------|-------|------------|
| 预览形式 | 独立浏览器窗口 | 桌面应用内嵌 Panel |
| 交互主体 | 用户主导注解、Agent 执行 | Agent 自动验证 + 用户视觉反馈 |
| 批注提交 | 用户手动提交到 thread | 选择元素后自动传递反馈 |
| 版本管理 | 无显式版本控制 | 单一工作流迭代 |
| 自动验证 | 需要手动操作 | 自动化验证循环（autoVerify） |

### 2.3 技术实现

Claude Code Preview 的技术栈：
- **配置文件**: `.claude/launch.json` 定义如何启动开发服务器
- **自动验证**: 提交代码后自动启动服务、截图、检查视觉问题、迭代修复
- **DOM 交互**: 通过脚本在 iframe 中执行点击、填充等操作
- **反馈循环**: 预览结果即时反映，支持选择元素传递反馈

---

## 3. 批注数据传递机制

### 3.1 Codex 方案

**批注上下文包含**:
```json
{
  "annotation_type": "element_or_region",
  "comment": "the button overflows on mobile",
  "selected_element": {
    "selector": ".primary-button",
    "tag": "button",
    "bounding_box": { "x": 245, "y": 102, "width": 150, "height": 48 }
  },
  "screenshot": "data:image/png;base64,..."
}
```

**传输方式**:
- 通过 WebSocket 发送到 Codex 应用
- 作为结构化聊天消息进入 Agent thread
- Agent 通过 Plan mode 或直接代码修改响应

### 3.2 Claude Code 方案

**反馈数据结构**:
```json
{
  "selected_elements": [
    {
      "selector": ".card",
      "action": "highlight",
      "context": "too narrow on mobile"
    }
  ],
  "viewport_size": { "width": 375, "height": 812 },
  "screenshot": "base64_encoded_image"
}
```

**传递流程**:
- DOM 选择通过内嵌脚本完成
- 反馈作为 Claude API 请求的一部分发送
- 不经过 MCP 协议（直接 API 调用）

### 3.3 agentic-html 对比

**agentic-html 特点**:
- **版本绑定**: 批注与版本强关联，支持版本级 sealed/unsealed 机制
- **MCP 协议**: 通过 Model Context Protocol 与 Agent 集成
- **完整元数据**: 保存 anchor_element、hit_elements、screenshot、timestamp
- **导出能力**: 支持 Markdown/JSON 导出，便于后续处理

---

## 4. 版本管理机制对比

### 4.1 Codex 版本管理

**特点**:
- **隐式版本化**: 无显式版本标识，基于时间序列隐式管理
- **单线迭代**: 用户批注 → Agent 修改 → 新的页面状态，线性流程
- **无版本回退**: 无法返回到特定批注状态

### 4.2 Claude Code 版本管理

**特点**:
- **代码版本**: 通过 Git diff 追踪代码变更，非 HTML 版本
- **单一工作空间**: 工作在单一版本上，无分支概念
- **预览状态临时性**: 预览状态不持久化

### 4.3 agentic-html 版本管理

**优势**:
- **显式版本树**: 版本号树形结构（如 v1.1、v1.2.1），支持分支和回退
- **批注绑定**: 每个版本携带对应的批注集，支持版本间批注对比
- **Graph 可视化**: 版本关系可视化展示，支持版本图查看
- **Seal 机制**: 版本可 seal（不可修改），防止并发冲突

```
v1.0 (sealed)
  ├─ v1.1 (unsealed) - 3 annotations
  │  ├─ v1.1.1 (sealed)
  │  └─ v1.1.2 (working)
  └─ v1.2 (sealed) - 2 annotations
```

---

## 5. 交互设计对比

### 5.1 操作流程对比

| 维度 | Codex | Claude Code | agentic-html |
|------|-------|------------|-------------|
| 启动方式 | 浏览器右上角按钮 | Preview 面板集成 | 左侧 Ink 工具栏按钮 |
| 选择方式 | 点选 + 圈画 | 点选 UI 元素 | 笔迹圈画（自由形状） |
| 批注输入 | 文本框 | 自动传递 | 文本框 + 截图 |
| 提交触发 | Enter 或按钮 | 自动 | 手动提交按钮 |
| 可视反馈 | 批注气泡 | 元素高亮 | 侧边栏列表 + 高亮 |

### 5.2 Figma 式设计（Codex）

Codex 特别强调"像 Figma 一样留评论"的交互体验：

**Figma 对标**:
- Figma: 在设计稿上圈画、添加评论、批量处理反馈
- Codex: 在浏览器上圈画、添加批注、批量处理改动

**优势**:
- 设计师和产品经理可直观理解
- 降低非技术人员参与门槛
- 支持批量注解后统一处理，提高效率

### 5.3 agentic-html 交互特点

**优势**:
- **笔迹圈画**: 支持自由形状圈画，不限于矩形选择
- **侧边栏管理**: 完整的 CRUD 操作、删除、编辑、查看
- **版本关联**: 清晰的版本 ID 显示，便于追踪
- **Hit-test 补充**: 自动检测圈画中的 DOM 元素并展示

**改进机会**:
- 支持快速键盘快捷键（如 Ctrl+Enter 快速提交）
- 批量操作支持（多选删除、批量标记 resolved）
- 评论模板或快速回复机制

---

## 6. 技术栈与实现方式

### 6.1 Codex 技术栈

```
Codex Desktop App
  ├─ Electron (桌面容器)
  ├─ Built-in Browser (Chromium)
  ├─ Annotation Layer (WebSocket)
  └─ Computer Use (自动化脚本)

通信方式:
  - WebSocket: Codex ↔ 用户批注
  - API: Codex ↔ Agent (批注进入 thread)
  - 截图: DOM snapshot → Base64
```

### 6.2 Claude Code 技术栈

```
Claude Code Desktop
  ├─ Electron (容器)
  ├─ Preview Panel (React)
  ├─ Dev Server Control (.claude/launch.json)
  ├─ DOM 交互脚本
  └─ 自动验证循环

通信方式:
  - 直接 API 调用 (无 MCP)
  - 本地进程管理 (dev server)
  - 截图通过内嵌脚本获取
```

### 6.3 agentic-html 技术栈

```
四层架构:
  Gateway Layer
    ├─ MCP Gateway (stdio 传输)
    └─ CLI Gateway (命令行)
       ↓
  Core Service Layer
    ├─ AnnotationService
    ├─ VersionService
    ├─ PatchService
    ├─ PreviewService
    └─ SnapshotService
       ↓
  UI Layer (Browser)
    ├─ InkCanvas (SVG 绘图)
    ├─ AnnotationSidebar (列表)
    ├─ PreviewFrame (iframe)
    └─ VersionGraph (可视化)

通信方式:
  - MCP Protocol (Agent 集成)
  - WebSocket (实时预览更新)
  - JSON (版本/批注数据)
```

### 6.4 依赖对比

| 技术 | Codex | Claude Code | agentic-html |
|------|-------|------------|-------------|
| 浏览器 | 内嵌 Chromium | 内嵌 Chromium | iframe sandbox |
| 绘图 | Canvas API | DOM 选择脚本 | SVG (笔迹) |
| 通信 | WebSocket | 直接 API | MCP + WebSocket |
| DOM 定位 | 坐标 + 选择器 | 选择器 | CSS Selector (主) |
| 版本管理 | 无 | 代码 Git 版本 | 显式版本树 |

---

## 7. 交互设计深入分析

### 7.1 Codex 批注模式的三层设计

**第一层：元素发现**
```
启用 Annotation Mode
    ↓
鼠标悬停时显示选择框 (hover highlight)
    ↓
点击选择或拖拽圈画
```

**第二层：反馈输入**
```
选择完成
    ↓
显示批注输入框
    ↓
支持文本、图片、链接等富文本
```

**第三层：提交与执行**
```
单个提交 (Enter)         批量提交 (Make these changes)
    ↓                          ↓
即刻进入 thread               收集所有批注
    ↓                          ↓
Agent 逐个响应          Agent 统一规划处理

优势: 支持两种工作流 (快速迭代 vs 批量优化)
```

### 7.2 Claude Code Preview 的自动验证设计

**自动循环** (当 autoVerify 启用时):
```
用户提交代码
    ↓
Claude 启动开发服务器
    ↓
Claude 截图验证效果
    ↓
Claude 检测视觉问题
    ↓
Claude 自动修复问题 (如果可信)
    ↓
重复直到满意

优势: 完全自动化，无需用户干预
缺点: 可能修复过度，不透明
```

### 7.3 agentic-html 的版本化交互设计

**多轮迭代保留**:
```
v1.0: 初始版本
    ↓ 用户批注 (3 条)
v1.1 (unsealed): 第一轮迭代
    ↓ 用户批注 (2 条)
v1.1.1 (sealed): 第二轮迭代
    ↓ 用户满意
v1.2 (sealed): 最终版本

优势:
  - 可查看每个版本的批注
  - 支持回退到任意版本
  - 清晰的迭代历史
  - 便于分支管理

缺点:
  - 版本数可能较多
  - 需要用户主动管理版本
```

---

## 8. Agent 集成方式对比

### 8.1 Codex 集成

**集成点**:
1. **浏览器批注 → Thread**: 批注作为用户消息进入当前 Agent thread
2. **上下文自动包含**: 页面截图、选中元素信息自动添加
3. **Agent 响应方式**:
   - Plan Mode: 修改计划后执行
   - Code Execution: 直接修改源代码
   - Computer Use: 自动操作浏览器验证

**优势**:
- 集成深度最深，批注直接成为 Agent 可见的输入
- 支持多种 Agent 响应方式

### 8.2 Claude Code 集成

**集成点**:
1. **Preview 反馈**: 用户在 Preview 面板选择元素
2. **自动送入 Context**: 所选元素信息作为 Claude API 请求的上下文
3. **Claude 响应**:
   - 修改代码文件
   - 更新预览
   - 自动验证

**特点**:
- 深度集成但相对隐式
- 无 MCP 协议，直接 API 调用
- 流程更自动化但用户可控性较低

### 8.3 agentic-html 集成

**集成点**:
1. **MCP 工具调用**: Agent 通过 `get_annotations` 获取批注
2. **推送通知**: 通过 `annotations_submitted` 通知推送批注到 Agent
3. **补丁应用**: Agent 通过 `apply_patch` 工具执行修改

**优势**:
- 标准 MCP 协议，支持任何 MCP client（Claude Code、Cursor 等）
- 流程显式清晰
- 支持 CLI 独立使用

**流程**:
```
用户在 UI 中批注
    ↓
AnnotationService 保存批注
    ↓
用户点击 Submit 按钮
    ↓
MCP Gateway 发送 annotations_submitted 通知
    ↓
Agent 接收通知 + 批注内容
    ↓
Agent 理解批注，规划修改
    ↓
Agent 调用 apply_patch 工具
    ↓
PatchService 生成新版本
```

---

## 9. 特殊功能对比

### 9.1 截图与视觉反馈

**Codex**:
- 自动截图当前浏览器状态
- 批注时自动捕获
- 用于提供视觉上下文

**Claude Code**:
- 自动验证时截图
- 用于视觉问题检测
- 支持多次迭代的截图对比

**agentic-html**:
- 支持可选的截图（screenshot 字段）
- 笔迹圈画时自动捕获
- 用于验证 hit-test 结果

### 9.2 批注状态管理

**Codex**:
- 无显式状态
- 批注提交后即进入处理流程

**Claude Code**:
- 预留字段但未充分利用
- 主要依赖代码 diff 状态

**agentic-html**:
- **pending**: 未解决的批注
- **resolved**: 已解决的批注
- 支持版本级 sealed 状态，防止已解决批注被修改

### 9.3 错误反馈

**Codex**:
- 基于浏览器错误控制台
- Agent 可读取错误消息

**Claude Code**:
- 自动截图检测视觉错误
- 自动验证检测的问题

**agentic-html**:
- HtmlErrorBanner: 界面显示 HTML 解析/渲染错误
- 用户可通过反馈按钮将错误推送给 Agent
- 结构化错误信息（parse_error, render_error, resource_missing）

---

## 10. 与 agentic-html 的对比分析

### 10.1 agentic-html 的独特优势

| 特性 | agentic-html | Codex | Claude Code |
|------|-------------|-------|------------|
| **版本化管理** | ✅ Graph 树形版本 | ❌ 隐式版本 | ❌ 单一工作区 |
| **批注绑定版本** | ✅ 版本级 sealed | ❌ 无绑定 | ❌ 无绑定 |
| **跨 Agent 兼容** | ✅ 标准 MCP | ❌ Codex 专有 | ❌ Claude 专有 |
| **CLI 独立使用** | ✅ 命令行工具 | ❌ 仅 Desktop App | ❌ 仅 Desktop App |
| **显式版本对比** | ✅ diff + Graph | ❌ 无 | ❌ 代码 diff |
| **笔迹圈画** | ✅ 自由形状 | ✅ 矩形 | ❌ 不支持 |

### 10.2 agentic-html 的改进机会

| 维度 | 差距 | 改进方案 |
|------|------|--------|
| **交互轻量性** | Codex 支持快速键盘提交 | 实现 Ctrl+Enter 快速提交、Batch 删除操作 |
| **自动验证** | Claude Code 支持自动截图验证 | 扩展 PreviewService，支持自动 diff 检测 |
| **批注模板** | Codex 无模板 | 支持常用反馈模板（如 "Mobile responsive", "Spacing issue" 等） |
| **多人协作** | Codex 支持多 cursor 并行 | 考虑支持多用户批注（通过 session 标识） |
| **视觉分层** | Claude Code 批注更突出 | 增强 AnnotationItem 的视觉层级（严重程度标记） |

### 10.3 技术架构建议

**保留的 agentic-html 优势**:
- ✅ 版本树管理 - 这是核心差异化能力
- ✅ MCP 标准协议 - 支持跨 Agent 生态
- ✅ CLI 工具链 - 支持非 UI 场景

**建议增强的方向**:
1. **交互优化**:
   - 快速键绑定 (Ctrl+Enter 提交、Del 删除)
   - 批量操作支持
   - 拖拽排序批注列表

2. **Agent 反馈自动化**:
   - 实现 "建议修复" 按钮，自动生成 patch
   - 支持一键应用 Codex 式的 "Make these changes" 流程
   - 自动截图对比

3. **数据可视化**:
   - 批注热力图（哪些元素被批注最多）
   - 版本变更统计
   - 批注-版本关联的时间线

4. **扩展生态**:
   - 支持批注评论回复（异步讨论）
   - 支持批注权限管理（谁可见、谁可编辑）
   - 支持批注导出到 GitHub Issues/Jira

---

## 11. 可借鉴的改进建议

### 11.1 交互设计借鉴

**来自 Codex**:
- 「批量注解后统一处理」: 添加 Batch Mode，收集多个批注后一次性处理
- 「快速键支持」: 实现 Enter 快速提交、Escape 取消
- 「Figma 式设计」: 强化圈画+评论的类 Figma 交互概念

**来自 Claude Code**:
- 「自动验证循环」: 提供 Auto-verify 选项，自动检测修改后的视觉变化
- 「侧边栏集成」: 考虑将 Preview + Annotations 更紧密地集成
- 「实时预览」: 支持修改时实时预览效果

### 11.2 数据设计借鉴

**Codex 的上下文设计**:
```json
{
  "annotation": "...",
  "screenshot": "...",     // 视觉上下文
  "dom_state": "...",      // DOM 快照
  "viewport": "..."        // 视口信息
}
```

**建议应用到 agentic-html**:
- 补充 hit_elements 中的 display 状态信息
- 记录批注时的视口尺寸 (影响响应式设计反馈)
- 保存批注时的浏览器控制台错误日志

### 11.3 工作流设计借鉴

**Claude Code 的 Plan + Execute 模式**:
```
用户批注
  ↓
Agent 生成 Plan (显示即将修改)
  ↓
用户审查 Plan
  ↓
执行修改
```

**应用到 agentic-html**:
- 支持 Patch Preview 模式（应用前展示 diff）
- 支持 Plan Review（让用户审查 Agent 的修改计划）
- 支持分步执行（可选执行哪些 patch）

---

## 12. 风险与限制

### 12.1 Codex 的局限性

1. **认证限制**: 内置浏览器不支持 Cookie/登录，无法访问需认证的应用
2. **安全风险**: 用户需手动管理批注权限，避免在公开页面泄露敏感信息
3. **平台差异**: 功能在 macOS 和 Windows 上的可用性不同

### 12.2 Claude Code 的局限性

1. **自动化过度**: autoVerify 可能进行不期望的修改
2. **多人协作弱**: 预览反馈是单向的，不支持实时多人讨论
3. **配置复杂**: .claude/launch.json 配置对新用户有门槛

### 12.3 agentic-html 的当前限制

1. **版本管理学习成本**: 树形版本可能对新用户造成混淆
2. **批注权限缺失**: 无法控制不同用户的批注可见性
3. **异步协作支持不足**: 无批注回复/讨论机制
4. **自动化程度低**: 需要手动触发批注提交和 patch 应用

---

## 13. 总结与建议

### 13.1 核心发现

1. **Codex 与 Claude Code 已成熟**: 主流 AI 编程代理均支持 HTML 预览+批注，交互已达到生产级
2. **agentic-html 的差异化**: 版本化批注管理是核心优势，但交互轻量性有差距
3. **MCP 标准化**: agentic-html 采用标准 MCP 协议，跨 Agent 兼容性更好
4. **工作流差异**:
   - Codex: 用户驱动注解 → Agent 执行
   - Claude Code: Agent 自动验证 + 用户反馈
   - agentic-html: 版本化迭代 + 显式提交

### 13.2 优先改进方向

**第一阶段（近期）**:
- [ ] 实现快速键绑定 (Ctrl+Enter 提交)
- [ ] 添加批注状态可视化 (pending/resolved 样式区分)
- [ ] 支持批注列表多选删除

**第二阶段（中期）**:
- [ ] 增加 Patch Preview 模式（应用前预览差异）
- [ ] 实现批注模板系统
- [ ] 支持自动版本推荐（何时应该 seal 版本）

**第三阶段（长期）**:
- [ ] 多用户协作支持
- [ ] 批注权限管理
- [ ] 与 GitHub Issues/Jira 的集成

### 13.3 路线图建议

```
Q3 2026: 交互优化 + 快速键
  ├─ Ctrl+Enter 快速提交
  ├─ 批量操作支持
  └─ 状态可视化

Q4 2026: 工作流自动化
  ├─ Patch Preview
  ├─ 自动版本管理
  └─ Plan Review 模式

Q1 2027: 多人协作
  ├─ 批注权限
  ├─ 批注讨论
  └─ 社交功能

Q2 2027: 生态集成
  ├─ GitHub Issues 导入/导出
  ├─ CI/CD 集成
  └─ 第三方工具链
```

---

## 附录

### A. 参考资源

**官方文档**:
- [Codex Browser 使用指南](https://learn.chatgpt.com/docs/browser)
- [Claude Code Preview 文档](https://code.claude.com/docs/en/features-overview)
- [agentic-html README](https://github.com/user/agentic-html)

**社区讨论**:
- Reddit: "Most slept on feature in the Codex App" 
- GitHub Issues: Codex #26198 (Selection-based comments)
- Medium: "OpenAI Codex's browser use feature"

**产品文章**:
- [Edit Web Designs Using UI Annotations in Codex](https://pandaitech.my/alpha/edit-web-designs-using-ui-annotations-in-the-codex-3228798c)
- [Claude Code Preview, Review, and Merge](https://claude.com/blog/preview-review-and-merge-with-claude-code)

### B. 术语对照

| 术语 | Codex | Claude Code | agentic-html |
|------|-------|------------|-------------|
| 批注 | Annotation | Preview feedback | Annotation |
| 版本 | 隐式（时间序列） | 工作空间 | 显式版本树 |
| 提交 | Enter / "Make these changes" | 自动 | Submit Button |
| 截图 | 自动捕获 | 自动验证 | 可选捕获 |
| 集成 | WebSocket + Thread | 直接 API | MCP Protocol |

### C. 功能完整度评分

| 功能 | Codex | Claude Code | agentic-html |
|------|-------|------------|-------------|
| HTML 预览 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 批注交互 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 版本管理 | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Agent 集成 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 跨生态兼容 | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| 交互轻量性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| CLI 可用性 | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 结论

Codex 和 Claude Code 已证明 **HTML 预览 + 批注评论** 是 AI 编程中的关键能力，有助于快速迭代和视觉反馈。agentic-html 在版本化管理和跨生态兼容性方面拥有独特优势，但在交互轻量性和自动化程度上有改进空间。通过借鉴 Codex 的快速键和批量处理、Claude Code 的自动验证，agentic-html 可进一步增强用户体验并扩大应用场景。

---

**报告完成于**: 2026 年 7 月  
**作者**: 研究分析团队  
**版本**: v1.0

