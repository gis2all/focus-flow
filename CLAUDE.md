# CLAUDE.md

## AI 快速上下文

- 项目名：`FocusFlow`
- 定位：本地优先的 Windows 桌面番茄钟客户端，核心场景是个人专注、任务绑定、本地统计。
- 技术栈：Electron 34、electron-vite 5、React 19、TypeScript 5、SQLite via `sql.js`、electron-log、Vitest。
- 包管理器：`npm`
- 源码目录：`core/`、`main/`、`preload/`、`renderer/`、`shared/`
- 构建产物：`output/build/`
- 发布产物：`output/release/`
- 可选商店包：`output/release/focusflow-appx.appx`
- 本地数据库：运行时创建在 `app.getPath('userData')/focusflow.sqlite`，不提交、不随发布包放入 `output/release/`。
- 远端仓库：`git@github.com:gis2all/focus-flow.git`
- 最近一次提交：以 `git log -1 --oneline` 的实时结果为准。

优先记住这些事实：

- 不要把业务规则塞回 React 组件；计时、统计、任务等规则优先放在 `core/` 或 `main/services/`。
- Renderer 只能通过 preload 暴露的 `window.focusFlow` API 访问桌面能力，不直接触碰 Electron 主进程对象。
- IPC channel、shared types、数据库 schema、打包产物命名都是稳定边界，改动前必须确认影响面。
- 当前是 Windows / PowerShell 语义；不要用 bash 风格 `&&` 串命令。
- 编辑 `md / ts / tsx / json / html / yml` 时优先用 `apply_patch` 或 UTF-8 安全写法，避免 PowerShell 编码问题。

## 不可破坏的边界

### 公共合同

- IPC channel 定义在 `shared/contracts.ts` 的 `IPC_CHANNELS`。
- Renderer API 类型定义在 `shared/contracts.ts` 的 `FocusFlowApi`。
- 共享数据形状定义在 `shared/types.ts`。
- 默认设置定义在 `shared/defaults.ts`。
- 小窗尺寸常量定义在 `shared/windowMetrics.ts`。
- 如需新增或修改跨进程 API，必须同步更新 `shared/contracts.ts`、`preload/index.ts`、`main/ipc/registerIpcHandlers.ts` 和相关测试。

当前 IPC 分组：

- `timer`：快照、开始、绑定任务、暂停、继续、跳过、重置。
- `tasks`：任务看板、列表、新增、更新、完成、恢复、排序、删除。
- `settings`：读取和更新设置。
- `stats`：总体统计和月历统计。
- `system`：主题、主窗口、小窗、拖拽、缩放、最小化、最大化、关闭、退出。

### 数据库

- SQLite schema 在 `main/adapters/sqlite/schema.ts`。
- 数据库初始化在 `main/adapters/sqlite/sqliteDatabase.ts`。
- 主进程启动时在 `main/index.ts` 调用 `createSqliteAppDatabase(join(app.getPath('userData'), 'focusflow.sqlite'))`。
- 如果 `focusflow.sqlite` 不存在，`sql.js` 会创建空数据库，执行 schema，并立即 flush 到磁盘。
- Windows 常见路径：`%APPDATA%/focusflow/focusflow.sqlite`。
- 安装版、`focusflow-single.exe` 单文件便携版、`output/release/focusflow-appx.appx` 安装出的 AppX 版本、`win-unpacked/focusflow.exe` 展开版默认共享同一个用户级 `userData` 数据库位置。
- `focusflow-single.exe` 是程序分发形态，不是数据便携形态；数据库不会放在 exe 同目录。
- 删除 `output/` 或重新打包不会删除用户数据库；迁移数据时需要退出应用后手动复制 `focusflow.sqlite`。
- AppX 身份信息当前允许使用本地验证占位值，但正式发布前必须替换。

当前核心表：

- `tasks`
- `timer_sessions`
- `settings`
- `timer_runtime`
- `app_events`

### 打包产物命名

- 安装包：`output/release/focusflow-setup.exe`
- 单文件便携版：`output/release/focusflow-single.exe`
- 可选 AppX 包：`output/release/focusflow-appx.appx`
- 展开版应用：`output/release/win-unpacked/focusflow.exe`
- 发布元数据：`output/release/latest.yml`，当前应引用 `focusflow-setup.exe`
- 差分/更新元数据：`output/release/*.blockmap`
- 打包诊断文件：`output/release/builder-debug.yml` 可能由 electron-builder 生成。

不要把 `win-unpacked/` 当成单文件便携版。`win-unpacked/focusflow.exe` 依赖同目录下的 Electron runtime、DLL、`resources/` 和 `locales/`，使用展开版时必须拷贝整个 `win-unpacked/` 目录。

## 目录地图

### `core/`

纯业务逻辑层，不依赖 Electron、React 或 SQLite 具体实现。

- `core/timer/timerState.ts`：计时状态机。
- `core/stats/statsAggregator.ts`：统计聚合。
- 对应测试：`core/**/*.test.ts`。

适合放：可单测的计时规则、统计口径、纯函数算法。

### `main/`

Electron 主进程层，负责应用启动、服务装配、窗口、托盘、通知、设置、数据库、IPC。

- `main/index.ts`：启动入口、数据库初始化、服务装配、窗口/托盘编排。
- `main/windowing.ts`：主窗口/小窗切换、小窗尺寸、默认位置、激活逻辑。
- `main/trayMenu.ts`：托盘菜单模板。
- `main/services/`：应用服务层。
- `main/services/taskDeletionService.ts`：任务删除编排服务。
- `main/repositories/`：SQLite repository 实现。
- `main/adapters/`：桌面能力、SQLite、通知帮助函数。
- `main/ports/`：仓储接口与桌面接口。
- `main/ipc/settingsUpdateRequest.ts`：`settings.update` 请求形状校验 helper。
- `main/ipc/registerIpcHandlers.ts`：IPC handler 注册。
- `main/timerSnapshotBroadcast.ts`：主进程计时快照广播 wiring 与 tick runner helper。
- `main/assets/`：主进程运行时资源，打包后复制到 `app-assets/`。

适合放：Electron 能力、持久化、IPC 编排、系统通知、托盘、小窗。

### `preload/`

安全桥接层。

- `preload/index.ts` 通过 `contextBridge` 暴露 `window.focusFlow`。
- 这里是 renderer 唯一能访问主进程能力的入口。

适合放：IPC invoke/send/on 的最小封装，不放业务规则。

### `renderer/`

React 渲染层。

- `renderer/main.tsx`：React 入口。
- `renderer/App.tsx`：主应用骨架。
- `renderer/viewModel.ts`：展示模型与格式化。
- `renderer/windowMode.ts`：主窗口/小窗模式识别。
- `renderer/timerActionConfirmation.ts`：计时中断确认规则。
- `renderer/views/`：Timer、Tasks、Stats、Settings、MiniTimer 页面。
- `renderer/components/`：标题栏、Shell、确认弹窗、图标组件。
- `renderer/assets/`：renderer 专用资源，例如标题栏 SVG。
- `renderer/styles/tokens.css`：设计 token。

适合放：视图状态、交互展示、组件样式。不要直接写 SQL、Electron API 或核心计时规则。

### `shared/`

跨进程共享合同层。

- `shared/contracts.ts`：IPC channel、请求类型、`FocusFlowApi`。
- `shared/types.ts`：任务、计时、统计、设置、事件类型。
- `shared/defaults.ts`：默认设置。
- `shared/settingsValidation.ts`：数值型设置的共享归一化与校验规则。
- `shared/windowMetrics.ts`：窗口尺寸常量。

适合放：跨 main/preload/renderer 共享且必须保持一致的类型和常量。

## 运行与发布

### 常用命令

```powershell
npm run dev
npm run build
npm test
npm run preview
npm run package
npm run package:appx:dev
```

- `npm run dev`：启动 `electron-vite dev --watch`，用于完整 Electron 开发态。
- `npm run build`：执行 `tsc --noEmit && electron-vite build`，输出到 `output/build/`。
- `npm test`：运行 `vitest run`。
- `npm run preview`：预览构建后的 Electron 应用。
- `npm run package`：默认 Windows 发布链路；先构建，再通过 `package-win.mjs` 预热 Windows 打包兼容层，最后生成 `nsis + portable`，输出到 `output/release/`。
- `npm run package:appx:dev`：唯一 AppX 打包入口；内部会自动准备或复用开发证书、在需要时拉起管理员导入机器级信任、执行构建，并通过 `package-win.mjs appx` 产出当前机器可直接安装的签名 `appx`。

直接在普通浏览器打开 `http://localhost:5173/` 时，只会看到 renderer 的浏览器态提示页。要验证完整交互、托盘、窗口控制和 preload API，请使用 `npm run dev` 拉起 Electron。

### Windows / PowerShell

- `npm run dev` 和 `npm run preview` 会自动清理 `ELECTRON_RUN_AS_NODE`，避免 Electron 误以 Node 模式启动。
- 如果需要手动执行 `electron.exe .` 或从当前终端直接拉起 Electron，可先执行：`Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue`
- PowerShell 中不要用 bash 风格 `&&`；使用 `;` 或显式条件。
- 本地辅助目录和产物默认不提交：`.learnings`、`.codex-log`、`.codex-logs`、`.superpowers`、`docs/`、`output/`、`coverage/`。
- 本地数据库文件默认忽略：`*.sqlite`、`*.sqlite-shm`、`*.sqlite-wal`。

### Windows 打包兼容层

- 打包工具：`electron-builder`
- Windows targets：`nsis`、`portable`、`appx`
- 默认 `npm run package` 仍只打 `nsis + portable`
- `package.json > build.win.icon`：`main/assets/focusflow-icon.ico`
- `package.json > build.win.executableName`：`focusflow`
- `package.json > build.nsis.oneClick`：`false`，保持 `focusflow-setup.exe` 为标准辅助安装向导，而不是一键安装。
- `package.json > build.nsis.allowToChangeInstallationDirectory`：`true`，允许用户修改安装目录。
- `package.json > build.nsis.selectPerMachineByDefault`：`false`，安装模式页默认选当前用户安装。
- `package.json > build.nsis.artifactName`：`focusflow-setup.${ext}`
- `package.json > build.portable.artifactName`：`focusflow-single.${ext}`
- `package.json > build.appx.artifactName`：`focusflow-appx.${ext}`
- `package.json > build.appx`：集中定义 `identityName`、`applicationId`、`publisherDisplayName`、`publisher` 等 AppX 元数据；当前允许本地验证占位值，正式发布前必须替换。
- `package.json > build.toolsets.winCodeSign`：固定为 `1.1.0`，让 `electron-builder` 在 Windows 上使用现代签名工具链并补齐 SHA256 摘要参数。
- AppX 资源位于 `main/assets/appx/`，由现有 `main/assets/focusflow-icon.png` 派生生成。
- `package-win.mjs` 会预热 `output/cache/electron-builder/`，为 legacy `winCodeSign-2.6.0` cache 提前放入现代 `rcedit`，默认无参数打 `nsis portable`，显式传 `appx` 时只打 `appx`。
- 兼容层目标是稳定 exe 图标与版本资源写入；这是项目级 workaround，不是系统权限修复。
- 开发证书脚本位于 `tools/appx/prepare-dev-cert.ps1` 和 `tools/appx/package-dev.ps1`，不要放回被忽略的 `scripts/`。
- 本地开发证书私钥创建在 `CurrentUser\My`，但 AppX 安装信任要导入 `LocalMachine\TrustedPeople`；脚本会优先复用已有机器级信任，缺失时拉起管理员 PowerShell 完成导入。
- `package.json > build.appx.publisher` 必须与开发证书 subject 完全一致；当前本地占位发布者是 `CN=gis2all`。
- 本地开发证书导出文件位于 `output/dev-cert/`，包含 `.pfx`、`.cer`、密码文件和 `metadata.json`，仅用于本机验证，不提交仓库。

### 干净 Windows 运行依赖

- 当前 Windows 包面向 x64 Windows，建议按 Windows 10/11 x64 验证；更旧系统不作为默认支持范围。
- `focusflow-single.exe` 可以只拷贝这一个文件；运行时会自解包到 `%TEMP%`。
- `focusflow-setup.exe` 可以只拷贝这一个文件安装运行；它现在是标准辅助安装向导，默认当前用户安装，并允许切换到所有用户安装和修改安装目录。
- `win-unpacked/focusflow.exe` 必须随整个 `win-unpacked/` 目录一起拷贝。
- 不要求目标机器预装 Node.js、npm、SQLite、WebView2 或项目依赖。
- Electron 自带 Chromium 与 Node runtime；`react`、`sql.js`、`electron-log` 等运行依赖打入 `resources/app.asar`。
- `sql.js` 的 `sql-wasm.wasm` 应随应用一起打包，数据库不依赖系统 SQLite。
- 目标机器需要允许写入 `%APPDATA%` 与 `%TEMP%`；前者用于 `focusflow.sqlite`，后者用于单文件便携版自解包。
- `appx` 包同样使用 `%APPDATA%` 下的 `focusflow.sqlite`；不要假设它会把运行时数据写入安装目录。
- `openAtLogin` 在 `appx` 下按平台能力处理；如需承诺与安装版完全一致，先单独验证，不要默认视为等价。
- Windows Defender、SmartScreen、企业安全策略或杀毒软件拦截属于系统安全策略问题，不应误判为缺少 Node、SQLite 或 WebView2。

## 功能索引

### 计时

- 核心状态机：`core/timer/timerState.ts`
- 主进程服务：`main/services/timerService.ts`
- 主进程广播辅助：`main/timerSnapshotBroadcast.ts`
- 运行时持久化：`timer_runtime` 表和 `SqliteTimerRuntimeRepository`
- Renderer 主计时页：`renderer/views/TimerView.tsx`
- 小窗计时页：`renderer/views/MiniTimerView.tsx`
- 中断确认：`renderer/timerActionConfirmation.ts`
- 测试入口：`core/timer/timerState.test.ts`、`main/services/timerService.test.ts`、`renderer/timerActionConfirmation.test.ts`

语义要点：

- 阶段：`focus`、`shortBreak`、`longBreak`
- 状态：`idle`、`running`、`paused`、`completed`
- 专注中断或重置前需要确认，避免误丢当前计时。
- 专注可绑定任务，也支持未绑定专注。
- `timer:snapshot` 广播职责由 `main/index.ts` 组合根持有；`registerIpcHandlers.ts` 只负责 handler 注册。
- 运行中不再存在 tick 路径重复推送 `timer:snapshot` 的链路。

### 任务

- 服务：`main/services/taskService.ts`、`main/services/taskBoardService.ts`、`main/services/taskDeletionService.ts`
- Repository：`main/repositories/sqliteRepositories.ts`
- UI：`renderer/views/TasksView.tsx`
- 共享类型：`Task`、`TaskBoardSnapshot`、`TaskBoardItem`
- 测试入口：`main/services/taskService.test.ts`、`main/services/taskBoardService.test.ts`、`main/services/taskDeletionService.test.ts`、`renderer/views/TasksView.test.tsx`

语义要点：

- 活跃任务支持拖拽排序，排序字段是 `sort_order`。
- 已完成任务保留 `completedAt`，用于完成列和统计。
- 删除任务时会先解绑当前运行中或暂停中的绑定专注。
- 删除任务时会同时删除该任务关联的历史 `focus` 记录。
- 完成解绑和历史记录删除后，才会删除任务本身。

### 统计

- 聚合：`core/stats/statsAggregator.ts`
- 服务：`main/services/statsService.ts`
- UI：`renderer/views/StatsView.tsx`
- 共享类型：`FocusStats`、`MonthStats`、`CalendarDayStats`
- 测试入口：`core/stats/statsAggregator.test.ts`、`main/services/statsService.test.ts`、`renderer/views/StatsView.test.tsx`

当前统计口径：

- 今日统计：专注分钟、休息分钟、完成番茄数、完成任务数。
- 总览统计：小时分布、任务专注时长、未绑定专注时长。
- 月历统计：每日聚合、未来日期标记、最大专注分钟、选中日任务明细。

### 设置

- 服务：`main/services/settingsService.ts`
- 共享校验：`shared/settingsValidation.ts`
- IPC request 校验：`main/ipc/settingsUpdateRequest.ts`
- 默认值：`shared/defaults.ts`
- 桌面适配：`main/adapters/desktop.ts`
- UI：`renderer/views/SettingsView.tsx`
- 测试入口：`main/services/settingsService.test.ts`、`main/ipc/settingsUpdateRequest.test.ts`、`renderer/views/SettingsView.test.tsx`

设置范围：

- 计时时长、长休间隔、自动开始休息、自动开始专注。
- 通知、提示音、开机自启、启动到托盘、关闭到托盘。
- 主题偏好：`system`、`light`、`dark`。
- 四个数值设置字段只接受合法 `number`，写入时会四舍五入并要求最小为 `1`。
- 读取已持久化设置时会自动修正脏数值，并把修正结果回写存储。
- malformed `settings.update` payload 会在 IPC 边界被拒绝。

### 窗口、小窗、托盘、通知

- 主窗口和小窗编排：`main/index.ts`
- 小窗尺寸和位置：`main/windowing.ts`
- 托盘菜单：`main/trayMenu.ts`
- Windows 通知：`main/adapters/desktop.ts`、`main/adapters/notificationHelpers.ts`
- 标题栏和窗口按钮：`renderer/components/WindowTitleBar.tsx`
- 浏览器态提示页：`renderer/BrowserEnvironmentNotice.tsx`

语义要点：

- 主窗口和小窗互斥显示。
- 小窗位置目前是进程内记忆，不启用数据库持久化。
- 关闭主窗口时根据 `closeToTray` 决定隐藏到托盘或退出。
- Windows 启动早期会调用 `app.setAppUserModelId(...)`；打包态 AUMID 是 `com.focusflow.timer`。

### 图标和资源

- Renderer SVG 品牌图标：`renderer/assets/icons/focusflow-icon.svg`
- Main/Windows 图标：`main/assets/focusflow-icon.png`、`main/assets/focusflow-icon.ico`
- 托盘图标：`main/assets/focusflow-tray.png`、`main/assets/focusflow-tray-dark.png`
- 打包时通过 `package.json > build.extraResources` 将 `main/assets` 复制到运行时 `app-assets/`。
- 主窗口、通知和托盘均从运行时资源路径加载。

## AI 修改路由

- 改计时规则：先看 `core/timer/timerState.ts`，再看 `main/services/timerService.ts`，最后看 renderer 展示。
- 改计时快照广播：优先看 `main/index.ts`、`main/timerSnapshotBroadcast.ts`、`main/ipc/registerIpcHandlers.ts`。
- 改任务行为：先看 `main/services/taskService.ts` / `taskBoardService.ts` / `taskDeletionService.ts`，再看 repository 和 `TasksView`。
- 改统计口径：先看 `core/stats/statsAggregator.ts` 和 `main/services/statsService.ts`。
- 改设置项：先看 `shared/types.ts`、`shared/defaults.ts`、`shared/settingsValidation.ts`、`main/ipc/settingsUpdateRequest.ts`、`main/services/settingsService.ts`、`renderer/views/SettingsView.tsx`。
- 改 IPC/API：同步 `shared/contracts.ts`、`preload/index.ts`、`main/ipc/registerIpcHandlers.ts`。
- 改窗口/托盘/小窗：优先看 `main/index.ts`、`main/windowing.ts`、`main/trayMenu.ts`。
- 改通知：优先看 `main/adapters/notificationHelpers.ts` 和 `main/adapters/desktop.ts`。
- 改打包命名或图标：优先看 `package.json`、`package-win.mjs`、`main/packageConfig.test.ts`、`main/assets/`。
- 改 renderer 样式：优先看对应 `renderer/views/*.tsx`、同目录测试、`renderer/styles/tokens.css`。

## 验证策略

优先按改动范围选择最小有效验证：

- 纯文档：重新读取文件并搜索关键事实；通常不需要跑测试。
- 共享类型或 IPC：跑 `npm test`，必要时加 `npm run build`。
- core 计时/统计：跑对应 `core/**/*.test.ts`，再跑相关 service 测试。
- main service/repository：跑对应 `main/**/*.test.ts`。
- renderer 组件/视图：跑对应 `renderer/**/*.test.tsx` 或 `renderer/**/*.test.ts`。
- 打包配置：跑 `npm test -- main/packageConfig.test.ts`。
- 构建路径、alias、资源路径：跑 `npm run build`。
- Windows 发布产物：跑 `npm run package`，检查 `output/release/` 中安装包、单文件便携版、`win-unpacked/` 和 `latest.yml`。
- AppX 打包链路：统一跑 `npm run package:appx:dev`，并检查 `output/release/` 中 `.appx` 产物与 `output/dev-cert/` 证书导出文件。
- 启动烟测：用 `output/release/focusflow-single.exe` 和 `output/release/win-unpacked/focusflow.exe` 分别验证；注意单文件版会自解包到 `%TEMP%`，可能受单实例锁影响。

当前测试框架：`vitest`

重点测试文件：

- `core/timer/timerState.test.ts`
- `core/stats/statsAggregator.test.ts`
- `main/repositories/sqliteRepositories.test.ts`
- `main/timerSnapshotBroadcast.test.ts`
- `main/ipc/registerIpcHandlers.test.ts`
- `main/ipc/settingsUpdateRequest.test.ts`
- `main/services/timerService.test.ts`
- `main/services/taskService.test.ts`
- `main/services/taskBoardService.test.ts`
- `main/services/taskDeletionService.test.ts`
- `main/services/statsService.test.ts`
- `main/services/settingsService.test.ts`
- `main/windowing.test.ts`
- `main/trayMenu.test.ts`
- `main/adapters/notificationHelpers.test.ts`
- `main/packageConfig.test.ts`
- `renderer/viewModel.test.ts`
- `renderer/timerActionConfirmation.test.ts`
- `renderer/windowMode.test.ts`
- `renderer/views/*.test.tsx`
- `renderer/components/*.test.tsx`

## 工作区纪律

- 可以处于脏工作区；不要回退用户已有修改。
- 提交前先看 `git status --short`，只暂存本次相关文件。
- 不要使用 `git reset --hard` 或 `git checkout --` 回退用户已有修改，除非用户明确要求。
- 不要提交 `output/`、数据库文件、coverage、本地辅助目录。
- 如果遇到看似乱码的中文，先用 UTF-8 安全读取验证，不要基于 PowerShell 显示直接判断文件损坏。
