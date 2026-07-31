# 项目协作规则

@memory/project.md
@memory/business-rules.md
@memory/open-items.md

## 本地运行

在项目根目录执行以下命令启动本地 HTTP 服务：

```bash
python3 -m http.server 8080
```

然后在浏览器中打开 http://localhost:8080

> 注意：本项目通过 fetch 加载 `config/nav.json`，必须通过 HTTP 服务器访问。
> 直接双击 `index.html`（file:// 协议）会导致导航菜单无法加载。

## 语法校验

```bash
# 校验所有 JS 文件语法
node --check js/app.js js/common.js js/nav.js
```

## 开始工作前

1. 涉及历史变更时阅读 `memory/change-log.md`，涉及需求时阅读 `docs/requirements.md` 和 `docs/decisions.md`。
2. 涉及页面标注时以 `.clauderules` 为唯一规则源。
3. 先理解现有代码和逻辑；非必要不得修改既有业务板块。

## 修改约束

- 本项目是无构建步骤的静态前端原型，入口为 `index.html`。
- 可复用 B 端公共组件放入 `js/components/`，页面逻辑放入 `js/pages/`。
- 修改业务规则后同步更新 `memory/business-rules.md`（该文件已被 CLAUDE.md 自动加载）。
- 未确认的问题写入 `memory/open-items.md`（该文件已被 CLAUDE.md 自动加载）。
- JS 修改后执行语法检查；资源路径修改后进行浏览器验证。

## 安全规则 (Safety Rules)

- **数据与逻辑分离**：所有大型 B 端数据集和 Mock 表格必须存放在 `mock/data.js` 中。严禁在 `js/pages/` 内部硬编码原始数据表。
- **配置文件架构分离**：CLAUDE.md 严格限定于本地开发/校验命令（运行、测试、语法检查等），而 `.clauderules` 专门用于页面标注系统的安装、维护和运行时规则。
