# 用户故事：Agent Native HTML 编辑插件

> 对应 RFC：`rfcs/html-editor-plugin.md`
> 编写日期：2026-07-20

---

## A. HTML 预览

### Story-01: 启动本地 HTML 文件预览

**As a** 开发者用户
**I want** 通过 Agent 或 CLI 启动本地 HTML 文件的实时预览
**So that** 我可以在浏览器中直观查看页面效果，无需手动搭建本地服务器

**验收标准：**

**Given** 本地存在一个合法的 HTML 文件 `index.html`
**When** 用户对 Agent 说"预览 index.html"或执行 `html-editor preview index.html`
**Then** 系统启动本地 HTTP 服务，创建初始版本 v1，返回预览 URL（`http://localhost:{port}/preview?file=...&session=...&version=v1`），浏览器打开后能看到完整渲染的 HTML 页面及标注工具栏

**Given** HTML 文件路径不存在
**When** 用户尝试启动预览
**Then** 系统返回明确错误信息"文件不存在：{path}"，不启动服务

---

### Story-02: 预览页面热更新

**As a** 开发者用户
**I want** 当 HTML 源文件被修改时预览页面自动刷新
**So that** 我能实时看到最新的页面效果，无需手动刷新浏览器

**验收标准：**

**Given** 预览已启动且浏览器正在显示页面
**When** HTML 源文件被修改并保存（包括 Agent 修改或用户手动修改）
**Then** 预览页面在 500ms 内自动更新为最新内容，无需用户手动刷新

**Given** 预览已启动但 WebSocket 连接意外断开
**When** HTML 源文件被修改
**Then** 页面显示"连接已断开"提示，用户手动刷新后可恢复连接

---

### Story-03: 关闭预览

**As a** 开发者用户
**I want** 关闭已启动的预览服务
**So that** 释放端口资源并终止不再需要的预览会话

**验收标准：**

**Given** 预览服务正在运行中（session_id 有效）
**When** 用户对 Agent 说"关闭预览"或执行 `html-editor preview --stop`，或 Agent 调用 `close_preview`
**Then** 本地 HTTP 服务停止，端口释放，session 标记为已关闭，浏览器显示"预览已关闭"

**Given** 预览服务未启动或 session_id 无效
**When** 用户尝试关闭预览
**Then** 系统返回提示"无活跃的预览会话"

---

## B. 标注操作

### Story-04: 笔迹圈画标注

**As a** 设计评审者
**I want** 在预览页面上用鼠标/触控笔自由圈画，并自动识别圈画区域内的 DOM 元素
**So that** 我可以直观地圈出需要修改的区域，无需精确点选具体元素

**验收标准：**

**Given** 预览页面已加载，用户切换到"圈画模式"
**When** 用户用鼠标在页面上自由绘制一个圈画
**Then** 笔迹实时渲染为 SVG path；松开鼠标后系统自动生成圈画区域截图（base64）并执行 hit-test 识别包围盒内所有 DOM 元素；弹出评论输入框

**Given** 圈画区域内没有任何可识别的 DOM 元素（如空白区域）
**When** 用户完成圈画
**Then** 系统提示"未命中有效元素"，仍允许提交为笔迹标注（hit_elements 为空数组），用户可在评论中说明意图

---

### Story-05: 选中 DOM 元素标注 — COMMENT 类型

**As a** 设计评审者
**I want** 点击选中页面上的某个 DOM 元素并添加评论
**So that** 我可以对特定元素给出明确的修改建议

**验收标准：**

**Given** 预览页面已加载，用户处于"标注模式"
**When** 用户鼠标悬停到某个 DOM 元素上
**Then** 该元素高亮显示（可视化边框）

**When** 用户点击该元素并输入评论内容后提交
**Then** 生成一条标注，包含：anchor_element（CSS Selector）、评论文本；页面上该元素显示高亮 + 评论气泡

---

### Story-06: 选中 DOM 元素标注 — 删除意图

**As a** 设计评审者
**I want** 选中某个 DOM 元素并标记为“需要删除”
**So that** Agent 能明确知道我要移除的内容

**验收标准：**

**Given** 预览页面已加载，用户处于“标注模式”
**When** 用户点击选中一个 DOM 元素，输入“删除这个元素”并确认
**Then** 生成一条标注，页面上该元素显示红色高亮效果

**Given** 用户误选了一个顶层结构元素（如 `<body>`）
**When** 用户尝试标记为“删除”
**Then** 系统弹出确认提示“您选择了顶层结构元素，删除将影响整个页面，是否确认？”

---

### Story-07: 选中 DOM 元素标注 — 修改意图

**As a** 设计评审者
**I want** 选中某个 DOM 元素并标记为“需要修改”，同时附加修改说明
**So that** Agent 能根据我的具体要求对该元素做出修改

**验收标准：**

**Given** 预览页面已加载，用户处于“标注模式”
**When** 用户点击选中一个 DOM 元素，输入修改说明后提交
**Then** 生成一条标注，包含修改说明；页面上该元素显示蓝色边框 + 评论气泡

---

### Story-08: 全局评论

**As a** 设计评审者
**I want** 对整个页面添加全局性评论（不针对特定元素）
**So that** 我可以表达对页面整体风格、布局、配色等方面的意见

**验收标准：**

**Given** 预览页面已加载
**When** 用户点击"全局评论"按钮，输入评论内容后提交
**Then** 生成一条标注，以 body 元素为 anchor_element，页面顶部显示通知条展示该评论

**Given** 用户输入空评论
**When** 尝试提交
**Then** 提交按钮禁用，提示"请输入评论内容"

---

### Story-09: 标注编辑

**As a** 设计评审者
**I want** 编辑已提交的标注（修改评论内容或更改标注类型）
**So that** 我可以修正之前的反馈而不需要删除重建

**验收标准：**

**Given** 当前版本为工作版本（非只读），页面上存在已提交的标注
**When** 用户点击某条标注的编辑按钮，修改评论内容后保存
**Then** 标注内容更新成功，页面标注气泡显示最新评论

**Given** 当前查看的是只读历史版本
**When** 用户尝试编辑标注
**Then** 编辑按钮禁用或不可见，提示"历史版本标注不可编辑"

---

### Story-10: 标注删除

**As a** 设计评审者
**I want** 删除不再需要的标注
**So that** 保持标注列表的清晰和准确

**验收标准：**

**Given** 当前版本为工作版本，页面上存在已提交的标注
**When** 用户点击某条标注的删除按钮并确认
**Then** 标注从列表中移除，页面上对应的视觉标记消失

**Given** 版本已被 sealed（标注已被 Agent 处理）
**When** 用户尝试删除该版本上的标注
**Then** 系统拒绝操作，提示“该版本已封存，标注不可修改”

---

### Story-11: 发送标注给 Agent（MCP 推送按钮）

**As a** 开发者用户
**I want** 在预览页面上点击"发送给 Agent"按钮，将所有标注推送给 Agent
**So that** Agent 能收到我的反馈并自动开始修改，无需在对话中手动复制描述

**验收标准：**

**Given** 预览页面上有至少一条未提交的标注，MCP Gateway 连接正常
**When** 用户点击"发送给 Agent"按钮
**Then** 标注数据（含笔迹截图 + hit-test DOM 信息 + 评论）通过 MCP notification 主动推送给 Agent；按钮显示"已发送"确认状态

**Given** 预览页面上没有任何标注
**When** 用户查看"发送给 Agent"按钮
**Then** 按钮处于禁用状态，不可点击

---

### Story-12: CLI 模式导出标注文件

**As a** 开发者用户
**I want** 通过 CLI 将标注数据导出为项目目录中的文件
**So that** 在不依赖 MCP 连接的情况下，Agent 或其他工具也能读取标注信息

**验收标准：**

**Given** 当前版本存在标注数据
**When** 用户执行 `html-editor annotations export --out ./annotations.json` 或在页面点击"发送给 Agent"按钮（CLI Gateway 模式）
**Then** 标注数据以 JSON 格式写入 `.html-editor/annotations/{version_id}.json`，文件包含完整标注信息

**Given** 当前版本没有任何标注
**When** 用户执行导出命令
**Then** 系统提示"当前版本无标注数据"，不生成文件

---

## C. Agent 交互

### Story-13: Agent 获取标注列表

**As a** Agent
**I want** 通过 MCP 工具或 CLI 命令获取某个版本的所有标注数据
**So that** 我可以理解用户的修改意图并规划修改方案

**验收标准：**

**Given** 版本 v1 上存在多条标注（包含圈画方式和点选方式创建的不同标注）
**When** Agent 调用 `get_annotations({ version_id: "v1" })`
**Then** 返回结构化标注数组，每条标注包含完整数据（anchor_element、comment、hit_elements、screenshot、ink_region 等）

**Given** 指定的 version_id 不存在
**When** Agent 调用 `get_annotations`
**Then** 返回错误信息"版本不存在：{version_id}"

---

### Story-14: Agent 基于标注进行定向修改

**As a** Agent
**I want** 根据标注内容调用 `apply_patch` 对 HTML 进行精确修改
**So that** 修改范围严格控制在用户标注指出的部分，保持其他区域不变

**验收标准：**

**Given** 版本 v1 上有一条标注指向 `body > div.hero > h1`，用户意见为“标题颜色改为 #1a73e8”
**When** Agent 调用 `apply_patch({ version_id: "v1", patches: [{ annotation_id: "ann-1", selector: "body > div.hero > h1", action: "modify_style", content: "color: #1a73e8" }] })`
**Then** 系统创建新版本 v1.1，仅修改目标元素样式，其余 HTML 不变；返回新版本 ID 和 diff；预览自动切换到 v1.1

**Given** patch 中的 CSS Selector 无法在当前 HTML 中定位到元素
**When** Agent 调用 `apply_patch`
**Then** 系统返回错误“DOM 定位失败”并附带定位诊断信息（原始 selector、建议操作）

---

### Story-15: Agent 获取 DOM 快照

**As a** Agent
**I want** 获取当前版本（或指定 selector 子树）的 DOM 结构快照
**So that** 我可以了解页面当前结构以规划修改方案

**验收标准：**

**Given** 预览正在运行，当前版本为 v1
**When** Agent 调用 `get_dom_snapshot({ version_id: "v1", selector: "div.hero" })`
**Then** 返回该 selector 匹配元素的完整 HTML 及 DOM 树结构

**Given** selector 未匹配到任何元素
**When** Agent 调用 `get_dom_snapshot`
**Then** 返回错误信息"selector 未匹配到元素：{selector}"

---

### Story-16: 修改后自动刷新预览

**As a** 开发者用户
**I want** Agent 通过 `apply_patch` 修改 HTML 后预览页面自动更新到新版本
**So that** 我不需要手动刷新就能看到修改结果

**验收标准：**

**Given** 预览正在运行，浏览器正显示版本 v1
**When** Agent 调用 `apply_patch` 成功创建版本 v1.1
**Then** 预览页面在 500ms 内自动切换到 v1.1 的内容，版本面板同步更新当前版本号

---

## D. 版本管理

### Story-17: 创建新版本（Agent 修改后自动产生）

**As a** Agent
**I want** 每次通过 `apply_patch` 修改 HTML 后自动生成一个新的只读版本
**So that** 所有修改历史都可追溯，用户可以回退到任意历史状态

**验收标准：**

**Given** 当前版本为 v1
**When** Agent 调用 `apply_patch` 或 `create_version` 创建新版本
**Then** 生成新版本 v1.1（或按树形编号规则），版本包含 HTML 快照和关联标注，一旦创建即不可变（immutable）

**Given** 父版本已有子版本 v1.1
**When** 基于同一父版本 v1 再次创建新版本
**Then** 生成版本 v1.2（分支），版本 Graph 中正确展示树形分支关系

---

### Story-18: 查看版本历史 Graph

**As a** 开发者用户
**I want** 在预览页面中查看版本历史的可视化树形图
**So that** 我能直观地了解修改历史和分支结构

**验收标准：**

**Given** 会话中已有多个版本（含分支）
**When** 用户点击版本面板展开版本 Graph
**Then** 显示版本树，每个节点展示版本号、缩略图、时间、标注数量；连线表示父子关系；支持 100+ 节点流畅展示

---

### Story-19: 版本对比

**As a** 开发者用户
**I want** 选择两个版本进行对比，查看 HTML 差异和各自的标注
**So that** 我能清楚地了解两个版本之间的具体变化

**验收标准：**

**Given** 会话中存在版本 v1 和 v1.1
**When** 用户在版本 Graph 中选择两个版本进行对比，或 Agent 调用 `compare_versions({ version_a: "v1", version_b: "v1.1" })`
**Then** 返回/展示 HTML diff（高亮增删改）以及两个版本各自的标注列表

**Given** 两个版本的 HTML 内容完全相同
**When** 用户进行版本对比
**Then** 显示"两个版本内容无差异"，仅展示标注差异（如有）

---

### Story-20: 从历史版本 checkout（不保留标注）

**As a** 开发者用户
**I want** 从某个历史版本 checkout 创建新的工作版本，不继承原版本标注
**So that** 我可以在历史版本基础上从零开始重新标注和迭代

**验收标准：**

**Given** 版本 Graph 中存在历史版本 v1
**When** 用户右键 v1 选择"Checkout（空白标注）"或 Agent 调用 `checkout_version({ version_id: "v1", keep_annotations: false })`
**Then** 创建新的工作版本，HTML 内容与 v1 相同，标注列表为空；预览切换到新工作版本

---

### Story-21: 从历史版本 checkout（保留标注）

**As a** 开发者用户
**I want** 从某个历史版本 checkout 并继承该版本的标注
**So that** 我可以在已有标注基础上继续补充和调整反馈

**验收标准：**

**Given** 版本 v1 上有 3 条标注
**When** 用户执行 checkout 并选择"保留标注"，或 Agent 调用 `checkout_version({ version_id: "v1", keep_annotations: true })`
**Then** 创建新的工作版本，HTML 与 v1 相同，标注列表包含 v1 的 3 条标注副本（可编辑）

---

### Story-22: 在 checkout 版本上增删改标注后提交

**As a** 设计评审者
**I want** 在 checkout 的工作版本上自由增删改标注，完成后提交为新的只读版本
**So that** 我的修改建议能以完整版本形式保存并发送给 Agent

**验收标准：**

**Given** 用户已从 v1 checkout 创建工作版本
**When** 用户添加 2 条新标注、删除 1 条继承的标注，然后点击"发送给 Agent"
**Then** 工作版本固化为新的只读版本（如 v1.2），包含最终的标注集；标注通过 MCP/CLI 发送给 Agent；版本 Graph 中 v1.2 显示为 v1 的子节点

---

## E. 边界/异常场景

### Story-23: HTML 文件格式错误

**As a** 开发者用户
**I want** 当 HTML 文件存在语法错误时系统能宽容处理并给出提示
**So that** 不会因为格式问题完全阻断预览和标注流程

**验收标准：**

**Given** 用户提供的 HTML 文件存在未闭合标签或语法错误
**When** 启动预览
**Then** 系统以浏览器的容错模式渲染页面（同浏览器原生行为），同时在标注工具栏显示警告"HTML 格式异常，部分标注定位可能不准确"

---

### Story-24: DOM 定位失效（Selector 找不到元素）

**As a** Agent
**I want** 当标注中的 CSS Selector 在当前 HTML 中无法匹配时获得明确的失败信息
**So that** 我可以告知用户需重新标注或调整修改策略

**验收标准：**

**Given** 标注的 CSS Selector `body > div.hero > h1` 在当前版本 HTML 中已不存在
**When** Agent 调用 `apply_patch` 使用该 selector
**Then** 系统直接返回错误“DOM 定位失败”并附带原始 selector 和建议操作（版本 HTML 是静态快照，无 fallback 机制）

---

### Story-25: MCP 连接断开

**As a** 开发者用户
**I want** 当 MCP 连接意外断开时标注数据不丢失
**So that** 我的工作成果得到保护，恢复连接后可以继续操作

**验收标准：**

**Given** 用户正在进行标注操作，MCP Gateway 连接正常
**When** MCP 连接意外断开（如 Agent 进程崩溃）
**Then** 页面显示"MCP 连接已断开"警告；标注数据自动持久化到本地存储（`.html-editor/working/annotations.json`）；"发送给 Agent"按钮切换为"导出标注文件"模式（CLI Gateway 降级）

**Given** MCP 连接恢复
**When** 用户重新打开预览或刷新页面
**Then** 自动加载本地持久化的标注数据，恢复工作状态

---

### Story-26: 标注大文件（>5MB HTML）

**As a** 开发者用户
**I want** 在处理大型 HTML 文件时获得明确的反馈
**So that** 我知道系统的处理能力边界并选择合适的操作方式

**验收标准：**

**Given** 用户提供了一个超过 5MB 的 HTML 文件
**When** 尝试启动预览
**Then** 系统显示警告"文件大小超过 5MB，预览和标注性能可能受到影响"；仍尝试加载预览，但禁用笔迹圈画截图功能（Canvas 截图对大 DOM 性能较差）

**Given** HTML 文件大小严重超标（>20MB）
**When** 尝试启动预览
**Then** 系统返回错误"文件过大，不支持预览"，建议用户精简文件

---

### Story-27: 版本 checkout 时原版本已有后继节点

**As a** 开发者用户
**I want** 从一个已有子版本的历史节点创建新分支
**So that** 我可以在同一父版本基础上探索不同的修改方向

**验收标准：**

**Given** 版本 v1 已有子版本 v1.1
**When** 用户从 v1 执行 checkout
**Then** 正常创建新分支工作版本（最终提交后成为 v1.2），版本 Graph 正确显示 v1 有两个子节点 v1.1 和 v1.2

**Given** 版本 v1 已有多个子版本（v1.1、v1.2、v1.3）
**When** 用户从 v1 再次 checkout
**Then** 新版本编号为 v1.4，系统无分支数量限制

---

### Story-29: 笔迹圈画命中区域无显著元素时兆底到 body

**As a** 设计评审者
**I want** 在圈画区域没有命中有意义的 DOM 元素时，系统兆底命中 body 并携带圈画位置信息
**So that** Agent 能通过圈画位置信息理解我圈画的大致区域

**验收标准：**

**Given** 用户在页面空白区域（无显著可见 DOM 元素）进行笔迹圈画
**When** hit-test 完成，未命中任何具体元素
**Then** 系统兆底命中 body 元素作为 anchor_element；标注数据中携带 ink_region（圈画在视口中的坐标区域）；截图正常生成；弹出评论输入框让用户描述期望效果

---

### Story-30: Agent 调用工具时版本 ID 无效

**As a** Agent
**I want** 当传入无效的版本 ID 时获得清晰的错误信息
**So that** 我可以正确处理异常并重新尝试

**验收标准：**

**Given** Agent 传入一个不存在的 version_id
**When** 调用 `get_annotations`、`apply_patch`、`get_dom_snapshot` 等任何需要 version_id 的工具
**Then** 返回统一格式的错误：`{ error: "VERSION_NOT_FOUND", message: "版本不存在: {version_id}", available_versions: [...] }`，附带当前可用版本列表

---

## F. 后续可选功能（Future）

### Story-31: Figma 风格节点树选择（Future）

**As a** 设计评审者
**I want** 通过左侧 DOM 节点树面板选择页面元素
**So that** 我可以精确选择嵌套层级较深或难以通过鼠标点击的元素

**验收标准：**

**Given** 预览页面已加载，节点树面板可见
**When** 用户点击节点树中的某个 DOM 节点
**Then** 页面上对应元素高亮显示；支持多选节点批量标注；圈画后自动展开对应节点

> **注**：此功能标记为 Future，不在 V1 范围内。

---

### Story-32: 无后继节点时自动重新生成（Future）

**As a** 开发者用户
**I want** 在版本 Graph 的叶子节点上一键触发 Agent 自动生成修改
**So that** 标注完成后无需手动指示 Agent，系统自动发起修改流程

**验收标准：**

**Given** 版本 v1.2 为叶子节点（无后继），且有标注数据
**When** 用户点击版本 Graph 中 v1.2 节点上的"自动生成"按钮
**Then** Agent 自动读取 v1.2 的标注，生成修改方案并创建新版本 v1.2.1

**Given** 版本节点有后继子节点
**When** 用户查看该节点
**Then** "自动生成"按钮不可见或禁用

> **注**：此功能标记为 Future，不在 V1 范围内。

---

## 补充说明

- 所有故事按场景类别分组（A-F）
- 每个类别包含正向验收和异常/边界验收
- 用户角色覆盖：开发者用户、Agent、设计评审者
- 故事总数：32 条
- 编号连续：Story-01 至 Story-32
