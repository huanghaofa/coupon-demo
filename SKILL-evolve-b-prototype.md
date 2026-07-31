---
name: evolve-b-prototype
description: 用于高效迭代、扩展和维护 B 端后台管理系统静态原型的核心技能。包含标准页面生成（增删改查、表单、表格）、动态菜单与路由自动化同步，以及高保真业务 Mock 数据的批量注入与状态维护。
---


# B 端后台原型演进技能 (Evolve B-Side Prototype)

本技能用于在 `create-prototype-project` 脚手架建立的项目基础上，进行深度的业务页面开发与数据维护。

## 工作流程 (Workflow)

1. **解析需求与记忆锚定**：
   - 读取 `docs/requirements.md` 中的新功能描述。
   - 检查 `memory/business-rules.md`，确保理解该 B 端业务领域的专业术语、状态流转逻辑或潜规则（如线索、转派、释放的定义）。
   - 读取 `.clauderules`，了解页面标注系统的安装、维护和运行时规则。

2. **数据与状态前置（Mock 注入）**：
   - 如果新页面涉及新的数据实体，首先在 `mock/data.js` 中设计并注入高保真的结构化 Mock 数据集（严禁直接在页面 JS 中写死数据）。
   - 在 `mock/data.js` 中暴露必要的增删改查或状态变更函数（如 `updateStatus`）。

3. **标准页面生成/重构**：
   - 在 `js/pages/` 下创建或修改对应的页面脚本（如 `clues.js`）。
   - **严格遵守三段式结构**：顶部面包屑与标题（Breadcrumb）、中部多条件高级搜索表单（Filter Bar）、底部带分页与操作列的数据表格（Data Table）。
   - **强迫组件复用**：表单中的弹窗、高级下拉框等必须调用 `js/components/` 中的公共组件。
   - 新页面需在页面脚本或 HTML 中注入 `window.AnnotationConfig = { projectId, page: "新页面key" }`，确保标注系统正常激活。

4. **路由与菜单自动化同步**：
   - 菜单树配置统一定义在 `config/nav.json` 中。修改该文件，新增页面对应的菜单项（含 `key`、`label`、`icon`、`children` 等字段）。
   - `js/nav.js` 负责读取 `config/nav.json`，动态渲染主导航并在页面切换时高亮激活项。
   - 严禁手动修改 `index.html` 中的静态 `<nav>` 列表。

5. **记忆与变更审计**：
   - 代码修改完成后，自动更新 `memory/change-log.md`（记录本次变更）。
   - 如有评审引入的待办项，挂起至 `memory/open-items.md`。

## 生成与演进规范 (Evolution Rules)

### 1. 页面 UI 与交互规范 (UI & Interaction)
- **色彩与风格**：必须统一遵循 `assets/css/global.css` 中定义的 B 端标准风格（默认科技蓝）。
- **组件调用限制**：禁止 AI 独立在单独页面内编写重复的弹窗（Modal）HTML，必须使用统一的公共组件。
- **反馈机制**：所有的异步/模拟操作（如点击"提交表单"、"删除记录"）必须触发成功/失败的 Toast 提示，或联动弹窗关闭，禁止无反馈交互。

### 2. 行业高保真 Mock 规范 (High-Fidelity Mock)
- **拒绝无意义数据**：禁止使用 `测试数据1`、`test` 等字段。必须根据实际业务场景（如汽车销售线索、供应商对账）编造极其逼真的行业数据。
- **状态机联动**：原型必须支持局部交互联动。例如点击表格中的"禁用"，必须调用 Mock 方法修改该行状态，并触发页面局部重新渲染，呈现真实的"已禁用"状态。

### 3. 单源信任与架构分离 (Single Source of Truth)
- **禁止硬编码路由**：不要手动去改 `index.html` 里的静态 `<nav>` 列表，必须由 `js/nav.js` 通过读取 `config/nav.json` 进行数据驱动渲染。
- **严禁数据下放**：页面逻辑脚本（`js/pages/*.js`）仅处理 DOM 绑定和事件监听，所有的数据源必须归拢于 `mock/data.js`。

## 命令与校验 (Validation)

在交付给用户前，Agent 必须在本地验证：
1. JavaScript 语法无错（特别是跨页面跳转和状态传递处的逻辑）。
2. HTML 中新引入的页面脚本或组件路径百分之百正确。
3. 确保所有新加的业务字段已在 `memory/business-rules.md` 中更新了定义。
