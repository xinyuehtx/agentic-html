# 示例 3: 版本历史 (version-history)

## 目的

验证 agentic-html 丰富的版本历史功能，包括：
- 版本树（Graph）的构建和可视化
- 分支（branching）版本管理
- 版本间 checkout 和 compare 操作
- sealed/unsealed 版本状态管理
- 版本 metadata（promptSummary）差异化展示

## 预置数据说明

### 版本结构（6 个版本，含分支）

```
ver-hist-001 (v1, sealed) ─── 基础页面
├── ver-hist-002 (v1.1, sealed) ─── 修改标题颜色和间距
│   └── ver-hist-003 (v1.1.1, sealed) ─── 微调字体大小
├── ver-hist-004 (v1.2, sealed) ─── 修改按钮样式（从 v1 分支）
└── ver-hist-005 (v2, sealed) ─── 大改版（全屏 hero + 统计 + 标签云）
    └── ver-hist-006 (v2.1, unsealed) ─── 当前工作版本（2 条待处理标注）
```

### 版本内容差异

| 版本 | 主要变化 | promptSummary |
|---|---|---|
| v1 | 基础技术博客页面 | 技术博客初始版本 |
| v1.1 | 标题色→#1a73e8，padding 80→60px | 修改标题颜色为品牌蓝，缩小间距 |
| v1.1.1 | h1 2.5→2.2rem，line-height 1.6→1.8 | 微调标题字体大小和行高 |
| v1.2 | CTA 按钮渐变+圆角+阴影 | 修改按钮为圆角渐变样式 |
| v2 | 全屏渐变 hero+统计数字+标签云 | 大改版重新设计 |
| v2.1 | 同 v2（工作副本），有 2 条标注 | 待处理标注反馈 |

### 标注内容 (v2.1, unsealed)

| ID | 目标元素 | 内容 |
|---|---|---|
| ann-hist-001 | `.hero > .stats` | 统计数字需要滚动动画 |
| ann-hist-002 | `.tags > .tag-cloud` | 标签云字体大小需体现权重 |

## 验证步骤

### 方式一：CLI

```bash
# 1. 查看完整版本图
npx agentic-html version history --path ./examples/version-history

# 预期输出：
# Graph: 6 nodes, 5 edges
# Root: ver-hist-001 (v1)
# Branches: v1→v1.1→v1.1.1, v1→v1.2, v1→v2→v2.1

# 2. 比较 v1 和 v2 的差异
npx agentic-html version compare ver-hist-001 ver-hist-005 --path ./examples/version-history

# 预期输出：大量 additions（新增 hero 全屏样式、stats、tags section）

# 3. 比较相邻版本 v1 和 v1.1
npx agentic-html version compare ver-hist-001 ver-hist-002 --path ./examples/version-history

# 预期输出：少量修改（padding、color 变化）

# 4. 查看工作版本的标注
npx agentic-html annotation list --version ver-hist-006 --path ./examples/version-history

# 预期输出：2 条 pending 标注

# 5. 检出历史版本
npx agentic-html version checkout ver-hist-003 --path ./examples/version-history
```

### 方式二：MCP

```json
// 1. 获取完整版本图
{ "tool": "html_version_history", "arguments": { "filePath": "./examples/version-history/index.html" } }

// 2. 比较大改版差异
{ "tool": "html_version_compare", "arguments": { "versionIdA": "ver-hist-001", "versionIdB": "ver-hist-005" } }

// 3. 检出分支版本
{ "tool": "html_version_checkout", "arguments": { "versionId": "ver-hist-004" } }

// 4. 获取工作版本标注
{ "tool": "html_annotation_list", "arguments": { "versionId": "ver-hist-006" } }
```

## 操作流程（适合截图标注）

1. 启动预览：`npx agentic-html preview ./examples/version-history/index.html`
2. 打开版本图面板 → 查看 6 个版本的树状关系
3. 点选 v1 和 v2 → 对比差异，查看大改版变化
4. 点选 v1.2 → checkout 到按钮样式分支
5. 切回 v2.1 工作版本 → 查看待处理标注
6. 处理标注 → seal 当前版本 → 观察版本号递增
