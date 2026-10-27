# 项目管理 · Project Manager

一个本地离线的个人软件项目全生命周期管理桌面应用：以需求为主线，管理项目从需求收集、沟通澄清、功能设计、版本排期，到开发跟踪和需求变更的全过程。

当前阶段：**干系人/项目 CRUD、原始需求导入、开发需求三种来源、需求台账和沟通记录工作区已完成；需求变更与版本排期尚未开始。**

## 技术栈

- Tauri 2
- Vue 3 + TypeScript + Vite
- Tailwind CSS v4（`@tailwindcss/vite`）
- shadcn-vue（`reka-vega` 风格，初始化时启用 `--pointer`）
- Vue Router（hash history）
- Pinia
- SQLite：`@tauri-apps/plugin-sql` + `tauri-plugin-sql`（sqlite）
- Excel 解析：Rust `calamine`
- 文件选择：`@tauri-apps/plugin-dialog` + `tauri-plugin-dialog`
- pnpm

## 样式约定

```
src/styles/
├─ index.css      统一入口，main.ts 只导入这个文件
├─ tailwind.css   由 shadcn-vue CLI 生成和维护，禁止手动修改
└─ theme.css      项目自定义主题覆盖
```

- `index.css` 依次导入 `tailwind.css` 和 `theme.css`。
- 需要调整 shadcn-vue 主题时，通过官方 CLI 重新生成，不要直接改 `tailwind.css`。
- 项目自己的颜色、间距、字体等扩展写在 `theme.css`。

## 已实现

- 干系人：列表、新建、编辑、删除；支持公司、多个联系方式（电话 / 微信 / 邮箱 / 其他）；角色在项目中填写
- 项目：列表、新建、编辑、删除；可搜索多选干系人，并为每个干系人填写本项目角色；状态、起止日期和描述
- 项目详情：概览（项目信息、干系人及本项目角色）、原始需求、开发需求和沟通记录
- 原始需求：导入客户 Excel（.xlsx / .xls / .ods），按模块和子项建立合同范围基线；支持多份来源文件和版本，保留 Excel 行号，导入后锁定
- 原始需求手工新建：没有 Excel 时可直接录入模块、标题和描述，归入“手工录入原始需求”来源文件
- 原始需求覆盖：按模块分组，显示每条原始需求已关联的开发需求和“未细化/已细化”状态；可一键细化并预填标题、描述和来源
- 开发需求来源：原始需求（必须关联原始需求）、沟通记录（必须关联来源沟通记录，可再关联原始需求）、直接创建
- 需求台账：自动编号、三级层级（需求 → 模块 → 子功能）、状态、类型、提出方、来源、优先级、预估人天、搜索筛选
- 需求跟踪：状态变化自动记录实际开发开始/完成日期
- 需求版本：每次保存生成版本快照，可查看历史版本内容
- 沟通记录：按“沟通主题 + 多个场次”组织，支持跨天续谈；独立整页编辑，输入自动保存，返回/关窗前会先保存，避免误关弹框丢失内容
- 沟通状态：草稿、进行中、已完成、已归档；归档代替物理删除，可恢复；已完成记录可重新打开
- 沟通附件：支持文件选择、Ctrl+V 粘贴微信截图、拖拽文件；图片缩略图预览，其他文件用系统程序打开；移除附件为软删除
- 工作台：项目/干系人统计、最近项目
- SQLite 迁移与本地持久化（`stakeholders`、`stakeholder_contacts`、`projects`、`project_stakeholders`、`requirements`、`requirement_revisions`、`communications`、`communication_sessions`、`communication_attachments`、`communication_requirements`、`source_documents`、`source_requirements`、`requirement_sources`、`communication_source_requirements`）
- 表单和对话框统一使用 shadcn-vue 组件
- 日期选择使用 shadcn `Calendar` + `Popover` 组合的 `DatePicker`
- 国际化默认简体中文（`zh-CN`）：界面、日期格式化、日历和表单提示统一中文，设置页展示当前语言

## UI 规范

- 业务代码中的表单控件必须使用 shadcn-vue 组件：`Button`、`Input`、`Textarea`、`Select`、`Combobox`、`Checkbox`、`Label`、`Dialog`、`Badge`、`Calendar`、`Popover`。
- 日期字段使用 `Calendar` + `Popover` 组合的 `DatePicker`，不使用原生 `date input`。
- 禁止在业务代码中直接使用原生 `<input>`、`<select>`、`<textarea>`、`<button>`；组件库内部实现除外。
- Tailwind 只负责布局、间距和展示型元素，不再手写表单控件样式。

## 数据库

- Rust 侧已注册 `tauri-plugin-sql`，启用 SQLite。
- 迁移 v1~v49 创建/重命名 `stakeholders`、`projects`、`project_stakeholders`、`stakeholder_contacts`、`requirements`、`requirement_revisions`、`communications`、`communication_sessions`、`communication_attachments`、`communication_requirements`、`source_documents`、`source_requirements`、`requirement_sources`、`communication_source_requirements`，并完成旧 `client_id`、角色代码、旧 `phone`、干系人全局角色和项目状态的迁移；项目新状态 `pending_start`（待启动）保存在 `projects.lifecycle_status`。
- 沟通记录原有字段保留为遗留列；新代码读写 `communication_sessions`。已有沟通记录在迁移时自动生成第一个场次，并回填主题和完成状态。
- 沟通附件复制到应用数据目录 `attachments/<project_id>/<communication_id>/`，数据库保存文件元数据和软删除时间。
- `requirements.origin` 保存开发需求来源（`baseline` / `communication` / `direct`）；原始需求与开发需求通过 `requirement_sources` 多对多关联。
- 原始需求文件复制到应用数据目录 `source_documents/<project_id>/`，数据库保存文件路径和版本信息；手工录入的原始需求使用 `source_documents.is_manual = 1` 的虚拟来源文件，不复制文件。
- `projects.client_id`、`projects.status`、`stakeholders.contact`、`stakeholders.phone`、`stakeholders.role` 以及 `communications` 的旧日期/摘要字段保留为未使用的遗留列，新代码不再读写。
- 前端封装在 `src/db/index.ts`，业务查询在 `src/db/stakeholders.ts`、`src/db/projects.ts`、`src/db/requirements.ts`、`src/db/communications.ts`、`src/db/sourceRequirements.ts`。
- capability 已添加 `sql:default`、`sql:allow-execute`、`dialog:default` 和 `opener:allow-open-path`；默认 SQL 权限只包含读取，写操作必须显式允许 execute。

## 开发

```bash
pnpm install
pnpm tauri:dev
```

仅启动前端：

```bash
pnpm dev
```

类型检查与前端构建：

```bash
pnpm typecheck
pnpm build
```

打包桌面应用：

```bash
pnpm tauri:build
```

## 环境要求

- Node.js 22 或 24
- pnpm
- Rust stable
- Windows 需要 WebView2（Windows 11 已自带）和 MSVC Build Tools

> 已知环境问题：本机 Node 24 下运行 shadcn-vue CLI 会卡住，使用 Node 22 运行 CLI 正常。

## 文档

- [需求梳理](docs/requirements.md)
- [MVP 页面与交互规格](docs/mvp-pages.md)

## 目录

```
docs/                需求与页面规格
src/
  components/        通用组件与布局
  db/                SQLite 连接封装
  router/            Vue Router 配置
  stores/            Pinia 状态
  styles/            样式入口、CLI 主题、自定义主题
  views/             页面
src-tauri/           Tauri / Rust 后端
```
