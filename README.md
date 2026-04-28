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
- 打包发布：支持 Windows `nsis` 安装包和 `portable` 便携版。

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

- 本地数据库会在运行时创建到 Electron 的 `app.getPath('userData')/focusflow.sqlite`。
- 构建产物输出到 `output/build/`。
- 发布产物输出到 `output/release/`。
- Windows 打包通过根目录的 `package-win.mjs` 运行 `electron-builder --win nsis portable`。
- `package-win.mjs` 会预热 `output/cache/electron-builder` 下的私有 builder cache，并为旧 `winCodeSign-2.6.0` 路径准备现代 `rcedit`，用于稳定写入 exe 图标和版本资源。

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
