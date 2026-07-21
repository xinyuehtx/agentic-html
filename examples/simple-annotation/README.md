# 示例 1: 基本圈画标注 (simple-annotation)

## 目的

验证 agentic-html 的基本圈画标注功能，包括：
- 点选元素后添加文字标注
- 圈画区域后添加截图标注（含 hit_elements 检测）
- 基于标注反馈执行 patch 生成新版本

## 预置数据说明

### 版本结构

```
ver-simple-001 (v1, sealed)
  └── ver-simple-002 (v1.1, unsealed) — patch 后的工作版本
```

### 标注内容 (ver-simple-001)

| ID | 类型 | 目标元素 | 内容 |
|---|---|---|---|
| ann-simple-001 | 点选 | `section.hero > h1` | 标题颜色改为品牌蓝 #1a73e8 |
| ann-simple-002 | 圈画 | `section.hero` | hero 区域间距太大，缩小到 40px |

### HTML 页面

一个简单的产品着陆页，包含：
- Hero 区域（标题 + 副标题 + CTA 按钮）
- 三栏特性展示区

## 验证步骤

### 方式一：CLI

```bash
# 1. 查看版本列表
npx agentic-html version list --path ./examples/simple-annotation

# 2. 查看 v1 的标注
npx agentic-html annotation list --version ver-simple-001 --path ./examples/simple-annotation

# 预期输出：
# - 2 条标注，状态为 pending
# - ann-simple-002 包含 screenshot 和 hit_elements

# 3. 对比 v1 和 v1.1 的差异
npx agentic-html version compare ver-simple-001 ver-simple-002 --path ./examples/simple-annotation

# 预期输出：
# - hero padding 从 80px 改为 40px
# - h1 新增 color: #1a73e8 样式
```

### 方式二：MCP

```json
// 1. 获取版本图
{ "tool": "html_version_history", "arguments": { "filePath": "./examples/simple-annotation/index.html" } }

// 2. 获取标注列表
{ "tool": "html_annotation_list", "arguments": { "versionId": "ver-simple-001" } }

// 3. 导出标注为 markdown
{ "tool": "html_annotation_export", "arguments": { "versionId": "ver-simple-001", "format": "markdown" } }
```

## 操作流程（适合截图标注）

1. 启动预览：`npx agentic-html preview ./examples/simple-annotation/index.html`
2. 在浏览器中点选 h1 标题 → 添加标注
3. 使用圈画工具框选整个 hero 区域 → 添加标注
4. Agent 读取标注 → 生成 patch → 应用修改
5. 查看 v1.1 版本的 diff 确认修改结果
