# 示例 2: 复杂 DOM 树 (complex-dom-tree)

## 目的

验证 agentic-html 在复杂 DOM 结构下的快照和 hit-test 精确性，包括：
- 深层嵌套元素的 CSS selector 生成准确性
- 多层级菜单、表格、表单等复杂结构的标注定位
- 圈画区域覆盖多个元素时的 hit_elements 检测
- 不同 DOM 深度的标注覆盖能力

## 预置数据说明

### 版本结构

```
ver-dom-001 (v1, sealed) — 唯一版本，包含 5 条标注
```

### HTML 页面（100+ DOM 节点）

后台管理面板，包含：
- 顶部导航栏（3 级菜单：首页 / 用户管理 > 角色权限 > 角色管理）
- 左侧边栏（3 个折叠面板）
- 主内容区：
  - 数据表格（thead + tbody 5 行 × 7 列）
  - 分页器
  - 表单（input/select/checkbox/radio/textarea）
  - 嵌套列表（3 层 ul > li）
- 模态框（隐藏状态）

### 标注内容 (5 条，覆盖不同深度)

| ID | 深度 | 目标元素 | 内容 |
|---|---|---|---|
| ann-dom-001 | 浅层 | `nav.top-nav` | 导航栏背景色太深 |
| ann-dom-002 | 中层 | `table > tbody > tr:nth-child(3)` | 禁用用户行需灰色背景 |
| ann-dom-003 | 深层 | 嵌套列表第3层 li | 修改文字内容 |
| ann-dom-004 | 表单 | checkbox-group | 增加权限选项 |
| ann-dom-005 | 圈画 | main-content 区域 | 添加搜索栏（含 hit_elements） |

## 验证步骤

### 方式一：CLI

```bash
# 1. 查看版本快照的 DOM 树
npx agentic-html snapshot tree --version ver-dom-001 --path ./examples/complex-dom-tree

# 预期输出：完整的 DOM 树结构，包含所有嵌套层级

# 2. 查看标注列表
npx agentic-html annotation list --version ver-dom-001 --path ./examples/complex-dom-tree

# 预期输出：5 条标注，selector 路径各不相同

# 3. 执行 hit-test 验证（模拟圈画区域）
npx agentic-html snapshot hit-test --version ver-dom-001 --bounds '{"x":264,"y":24,"width":900,"height":430}' --path ./examples/complex-dom-tree

# 预期输出：命中 h1.page-title、table.data-table、div.pagination
```

### 方式二：MCP

```json
// 1. 获取 DOM 快照树
{ "tool": "html_snapshot_tree", "arguments": { "versionId": "ver-dom-001" } }

// 2. hit-test 精确检测
{ "tool": "html_snapshot_hit_test", "arguments": { "versionId": "ver-dom-001", "bounds": { "x": 264, "y": 24, "width": 900, "height": 430 } } }

// 3. 获取深层标注详情
{ "tool": "html_annotation_get", "arguments": { "annotationId": "ann-dom-003" } }
```

## 操作流程（适合截图标注）

1. 启动预览：`npx agentic-html preview ./examples/complex-dom-tree/index.html`
2. 点选导航栏 → 验证浅层元素标注
3. 点选表格中某一行 → 验证中层元素定位
4. 点选嵌套列表深层 li → 验证 selector 精确生成
5. 圈画表格+分页器区域 → 验证 hit_elements 多元素检测
6. 检查所有标注的 selector 是否能正确定位到目标元素
