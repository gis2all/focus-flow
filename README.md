# FocusFlow

FocusFlow 是一个本地优先的 Windows 桌面番茄钟客户端，面向个人专注、任务绑定与本地统计场景。项目当前优先完成 V1 功能闭环，并保持业务逻辑、桌面能力和 React 界面之间的低耦合分层。

## 功能概览

- 番茄钟阶段：支持专注、短休、长休。
- 计时控制：支持开始、暂停、继续、跳过、重置。
- 任务管理：支持新增、行内编辑、完成、恢复、删除和进行中任务拖拽排序。
- 当前轮任务绑定：运行中的专注可以绑定或解绑任务，也可以从待办页直接设为当前任务并开始专注。
- 风险确认：运行中或暂停中的计时被打断前会弹出确认。
- 统计页：支持今日统计、小时分布、时间构成、月历热力图和按日期查看专注明细。
- 桌面能力：支持系统托盘、关闭到托盘、启动到托盘、开机自启、Windows 通知和提示音。
- 窗口能力：支持主窗口和小窗模式，二者互斥显示。
- 主题能力：支持白天、黑暗和跟随系统。
- 打包发布：支持 Windows `nsis` 安装包和 `portable` 单文件便携版。

## 技术栈

- Electron 34
- electron-vite 5
- React 19
- TypeScript 5
- SQLite via `sql.js`
- `electron-log`
- Vitest
- npm

## 本地开发

先安装依赖：

```powershell
npm install
```

常用命令：

```powershell
npm run dev
npm run build
npm test
npm run preview
npm run package
```

命令说明：

- `npm run dev`：启动 `electron-vite dev --watch`，用于本地开发。
- `npm run build`：执行 TypeScript 类型检查并构建 Electron 三端产物。
- `npm test`：运行 Vitest 测试。
- `npm run preview`：预览构建后的 Electron 应用。
- `npm run package`：先构建，再通过 `package-win.mjs` 执行 Windows 打包。

## 项目结构

项目采用低耦合分层，主路径是：

```text
core -> services -> adapters -> UI
```

关键目录：

- `core/`：纯业务逻辑层，不依赖 Electron、React 或 SQLite 具体实现；包含计时状态机和统计聚合逻辑。
- `main/`：Electron 主进程层，负责应用启动、服务装配、窗口、托盘、通知、设置、数据库和 IPC。
- `preload/`：通过 `contextBridge` 暴露有限 API 到 `window.focusFlow`，隔离 Electron 与渲染层。
- `renderer/`：React 渲染层，负责主窗口、小窗、计时页、待办页、统计页和设置页。
- `shared/`：共享类型、IPC channel、默认设置和窗口尺寸常量。

## 数据与打包

### 数据库

- 当前项目不提交初始数据库，也不会把数据库打进发布包。
- 应用启动时，主进程会在 Electron 的 `app.getPath('userData')` 目录下创建或打开 `focusflow.sqlite`。
- Windows 常见位置是 `%APPDATA%/focusflow/focusflow.sqlite`，例如 `C:/Users/<用户名>/AppData/Roaming/focusflow/focusflow.sqlite`。
- 如果新电脑第一次启动时没有这个文件，程序会自动创建空数据库、执行建表 schema，并写入磁盘。
- 安装版、单文件便携版和 `win-unpacked/` 展开版在同一用户下默认使用同一个 `userData` 数据库位置。
- `focusflow-single.exe` 是程序单文件便携包，不是数据便携包；数据库不在 exe 同目录，也不会随拷贝 exe 自动带走。
- 删除 `output/`、`output/release/` 或重新打包不会删除用户数据库。
- 如需迁移数据，应先退出 FocusFlow，再复制旧电脑的 `focusflow.sqlite` 到新电脑对应的 `userData` 目录。

### 输出目录与发布包

- `output/build/`：`npm run build` 生成的 Electron main、preload、renderer 构建产物。
- `output/release/focusflow-setup.exe`：Windows 安装包，面向正常安装使用。
- `output/release/focusflow-single.exe`：Windows 单文件便携版，可以单独拷贝运行，但运行数据仍在 `userData`。
- `output/release/win-unpacked/focusflow.exe`：未压缩的展开版应用，主要用于开发者烟测图标、资源和启动行为。
- `output/release/latest.yml`：发布元数据，当前引用安装包 `focusflow-setup.exe`。
- `output/release/*.blockmap`：安装包差分/更新相关元数据。
- `output/cache/electron-builder/`：`package-win.mjs` 使用的项目级 electron-builder cache。
- `output/` 是生成物目录，默认不提交；需要时可删除后通过 `npm run build` 或 `npm run package` 重新生成。
- Windows 打包通过根目录的 `package-win.mjs` 运行 `electron-builder --win nsis portable`。兼容层会为旧 `winCodeSign-2.6.0` 路径准备现代 `rcedit`，用于稳定写入 exe 图标和版本资源。

## Windows 注意事项

- 当前 `dev` 和 `preview` 脚本已经在命令里清理 `ELECTRON_RUN_AS_NODE`，避免 Electron 被误当成 Node 进程启动。
- 本项目默认在 PowerShell 环境开发；不要使用 bash 风格的 `&&` 来串联命令。
- 修改 Markdown、TypeScript、JSON 等编码敏感文件时，优先使用 UTF-8 安全写法，避免 PowerShell 默认编码造成中文内容异常。

## 协作约定

- 计时规则优先放在 `core/timer` 和 `main/services/TimerService`，不要重新塞回 React 页面。
- 统计口径优先放在 `core/stats` 和 `main/services/StatsService`。
- 数据访问尽量走 repository，不要在 service 外直接写 SQL。
- 渲染层只依赖 preload 暴露的 `window.focusFlow` API，不直接触碰 Electron 主进程对象。
- 新增桌面能力时优先通过 `main/adapters` 和 `main/ports` 建模。
