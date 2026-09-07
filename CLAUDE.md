# CLAUDE.md

## 0. 可选：优先使用 code-review-graph

本仓库建有 `.code-review-graph/graph.db`。定位代码、调用链、影响面时，**如果当前环境已挂载 `code-review-graph` MCP**，可优先用它，避免全文读文件或全仓搜索；若工具不可用，则直接按下方「目录地图」「AI 修改路由」定位，不要因此卡住。

可选流程（按需使用）：

1. 先 `get_minimal_context_tool`（`detail_level="minimal"`），根据结果决定下一步工具。
2. 理解整体架构用 `get_architecture_overview_tool`；评审改动用 `detect_changes_tool` + `get_review_context_tool`；追踪调用/依赖用 `query_graph_tool` 或 `semantic_search_nodes_tool`。
3. 判断影响面用 `get_impact_radius_tool`、`get_affected_flows_tool`、`get_flow_tool`。
4. 若图谱缺失或过期，可 `build_or_update_graph_tool`（或 `code-review-graph update`）后复用。

## AI 快速上下文

- 项目名：`FocusFlow`
- 定位：本地优先的番茄钟客户端，主体是 Windows 桌面应用；同一套 renderer 也可作为网页运行（本地 Web 后端复用核心逻辑）。核心场景是个人专注、任务绑定、本地统计。
- 技术栈：Electron 41.3.0、electron-builder 26.15.3、electron-vite 5、Vite 7.3.6、React 19、TypeScript 5、SQLite via `sql.js`、electron-log、Vitest 4.1.10、Playwright 1.61.1。
- 包管理器：`npm`
- 源码目录：`core/`、`main/`、`preload/`、`renderer/`、`shared/`；Web 后端在 `server/`，Web 传输层在 `renderer/web/`。
- 构建产物：`output/build/`
- 发布产物：`output/release/`
- 可选商店包：`output/release/focusflow-appx.appx`
- 本地数据库（桌面端）：运行时创建在 `app.getPath('userData')/focusflow.sqlite`，不提交、不随发布包放入 `output/release/`。
- 本地数据库（Web 端）：`server/` 使用独立 SQLite（默认 `%USERPROFILE%\.focusflow-web\focusflow.sqlite`），与桌面端数据库互不共享。
- 远端仓库：`git@github.com:gis2all/focus-flow.git`
- 最近一次提交：以 `git log -1 --oneline` 的实时结果为准。

优先记住这些事实：

- 不要把业务规则塞回 React 组件；计时、统计、任务等规则优先放在 `core/` 或 `main/services/`。
- Renderer 只能通过 preload 暴露的 `window.focusFlow` API 访问桌面能力，不直接触碰 Electron 主进程对象。
- Web 端复用 `core/` 与 `main/services/`，通过 `server/rpc.ts` 做 `POST /api/rpc` 分发，channel 复用 `IPC_CHANNELS`，并复用 `main/ipc/requestValidation.ts` / `settingsUpdateRequest.ts` 做运行时校验。
- Web 端计时状态由服务端进程持有（等同桌面主进程），通过 SSE `/api/events` 推送 `timer:snapshot`；通知/声音/主题由浏览器客户端负责。
- Preload 必须保持 sandbox 兼容，并以 CommonJS 输出到 `output/build/preload/index.cjs`。
- IPC channel、shared types、数据库 schema、打包产物命名都是稳定边界，改动前必须确认影响面。
- IPC 入参在主进程边界做运行时校验；不要把 TypeScript 类型当作不可信 renderer 数据的运行时保证。
- 当前是 Windows / PowerShell 语义；不要用 bash 风格 `&&` 串命令。
- 编辑 `md / ts / tsx / json / html / yml` 时优先用 `apply_patch` 或 UTF-8 安全写法，避免 PowerShell 编码问题。

## 不可破坏的边界

### 公共合同

- IPC channel 定义在 `shared/contracts.ts` 的 `IPC_CHANNELS`。
- Renderer API 类型定义在 `shared/contracts.ts` 的 `FocusFlowApi`。
- 共享数据形状定义在 `shared/types.ts`。
- 默认设置定义在 `shared/defaults.ts`。
- 小窗尺寸常量定义在 `shared/windowMetrics.ts`。
- 如需新增或修改跨进程/跨传输 API，必须同步更新 `shared/contracts.ts`、`preload/index.ts`（桌面）、`renderer/web/api.ts`（Web）、`main/ipc/registerIpcHandlers.ts`（桌面）与 `server/rpc.ts`（Web）及相关测试。
- IPC / RPC 请求校验集中在 `main/ipc/requestValidation.ts` 和 `main/ipc/settingsUpdateRequest.ts`；新增带 payload 的 channel 时必须补对应运行时校验。

当前 IPC / RPC 分组：

- `timer`：快照、开始、绑定任务、暂停、继续、跳过、重置。
- `tasks`：任务看板、列表、新增、更新、完成、恢复、排序、删除。
- `settings`：读取和更新设置。
- `stats`：总体统计和月历统计。
- `system`：主题、主窗口、小窗、拖拽、缩放、最小化、最大化、关闭、退出（Web 端为客户端本地处理，不走 RPC）。

### Electron 安全边界

- BrowserWindow 使用 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`webviewTag: false`。
- `main/security.ts` 统一拒绝 renderer 新开窗口、页面跳转和权限请求。
- Renderer 中不应存在可用的 Node.js `process`、`require` 或 Electron API；唯一桌面桥接是 `window.focusFlow`。
- 改窗口创建、preload 或 IPC 时，至少同步检查 `main/security.test.ts`、`main/ipc/requestValidation.test.ts` 和真实 Electron E2E。

### Web 边界

- Web 端不引入 Electron；`server/` 只依赖 `core/`、`main/services/`、`main/repositories/`、`main/adapters/sqlite/` 与 `shared/`。
- 网页端 renderer 通过 `renderer/web/api.ts` 注入 `window.focusFlow`（HTTP + SSE），不与 preload/IPC 混用。
- `POST /api/rpc` 的入参必须在服务端用 `requestValidation.ts` / `settingsUpdateRequest.ts` 做运行时校验；不要因 Web 端而放松校验。
- Web 端是“单进程单一计时权威”，多标签页共享同一状态；桌面端与 Web 端使用不同数据库，不要混用同一 `focusflow.sqlite`。
- Web 服务默认绑定 `127.0.0.1`，无鉴权；仅在显式配置 `FOCUSFLOW_WEB_HOST` 后才可对外暴露。

### 数据库

- SQLite schema 在 `main/adapters/sqlite/schema.ts`。
- 数据库初始化在 `main/adapters/sqlite/sqliteDatabase.ts`。
- 主进程启动时在 `main/index.ts` 调用 `createSqliteAppDatabase(join(app.getPath('userData'), 'focusflow.sqlite'))`。
- 如果 `focusflow.sqlite` 不存在，`sql.js` 会创建空数据库，执行 schema，并立即 flush 到磁盘。
- 数据库写入通过临时文件和原子替换落盘，并维护 `focusflow.sqlite.bak`；启动时会依次尝试临时文件、主文件和备份文件恢复。
- 写操作串行化；顶层事务负责 `BEGIN / COMMIT / ROLLBACK` 和统一落盘，嵌套事务复用当前事务上下文。
- schema 迁移版本记录在 `PRAGMA user_version`，当前版本是 `2`；遇到高于当前版本或非法版本时拒绝启动迁移。
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
- `main/ipc/requestValidation.ts`：计时、任务、统计和窗口相关 IPC payload 的运行时校验。
- `main/ipc/registerIpcHandlers.ts`：IPC handler 注册。
- `main/security.ts`：BrowserWindow webPreferences 与导航、弹窗、权限策略。
- `main/timerSnapshotBroadcast.ts`：主进程计时快照广播 wiring 与 tick runner helper。
- `main/assets/`：主进程运行时资源，打包后复制到 `app-assets/`。

适合放：Electron 能力、持久化、IPC 编排、系统通知、托盘、小窗。

### `preload/`

安全桥接层。

- `preload/index.ts` 通过 `contextBridge` 暴露 `window.focusFlow`。
- 构建配置强制输出 sandbox 兼容的 CommonJS 文件 `output/build/preload/index.cjs`；主进程窗口必须加载这个路径。
- 这里是 renderer 唯一能访问主进程能力的入口。

适合放：IPC invoke/send/on 的最小封装，不放业务规则。

### `renderer/`

React 渲染层。

- `renderer/main.tsx`：React 入口；在浏览器无 preload 时注入 Web 版 `window.focusFlow`。
- `renderer/App.tsx`：主应用骨架。
- `renderer/viewModel.ts`：展示模型与格式化。
- `renderer/windowMode.ts`：主窗口/小窗模式识别。
- `renderer/timerActionConfirmation.ts`：计时中断确认规则。
- `renderer/views/`：Timer、Tasks、Stats、Settings、MiniTimer 页面。
- `renderer/components/`：标题栏、Shell、确认弹窗、图标组件。
- `renderer/assets/`：renderer 专用资源，例如标题栏 SVG。
- `renderer/styles/tokens.css`：设计 token；其中包含 web 模式下“居中卡片 + 自适应 + 留白”的布局规则（`data-focus-flow-web` 生效）。
- `renderer/BrowserEnvironmentNotice.tsx`：曾是“无 preload 兜底页”；现 Web 模式下由 `renderer/web/api.ts` 接管入口，此组件已较少使用。
- `renderer/public/`：Vite 静态资源，例如 `favicon.svg`。

Web 传输层（浏览器端）：

- `renderer/web/api.ts`：实现 `FocusFlowApi`，data 类走 `POST /api/rpc`，计时推送走 SSE `/api/events`；`system.*` 本地降级。
- `renderer/web/notify.ts`：客户端完成通知（浏览器 Notification）与提示音（WebAudio）。

适合放：视图状态、交互展示、组件样式。不要直接写 SQL、Electron API 或核心计时规则。

### `shared/`

跨进程共享合同层。

- `shared/contracts.ts`：IPC channel、请求类型、`FocusFlowApi`。
- `shared/types.ts`：任务、计时、统计、设置、事件类型。
- `shared/defaults.ts`：默认设置。
- `shared/settingsValidation.ts`：数值型设置的共享归一化与校验规则。
- `shared/windowMetrics.ts`：窗口尺寸常量。

适合放：跨 main/preload/renderer/server 共享且必须保持一致的类型和常量。

### `server/`

Web 浏览器端后端（仅 Node，不依赖 Electron）。让同一个 renderer 作为可访问网页运行，桌面端保持不变。

- `server/index.ts`：HTTP + SSE 服务；`POST /api/rpc` 分发、`GET /api/events` 推送计时快照；同源托管 `output/build/renderer`；1s tick 循环；静态托管做了路径穿越防护与非法编码容错。
- `server/rpc.ts`：channel 到 service 的分发表，channel 复用 `IPC_CHANNELS`。
- `server/composition.ts`：装配 repositories / services（TimerService 的 notifier/sound 用 no-op 端口）。
- `server/clock.ts`：`ServerClock` 实现 `ClockPort`。
- `server/noopPorts.ts`：服务端 no-op 的通知/声音/自启/主题端口。
- 测试：`server/rpc.test.ts`。

适合放：Web 传输编排；不要在此写业务规则，业务规则仍在 `core/` / `main/services/`。

## 运行与发布

### 常用命令

```powershell
npm run dev
npm run build
npm test
npm run test:coverage
npm run test:e2e
npm run preview
npm run package
npm run test:package-smoke
npm run package:appx:dev
npm run web:dev
npm run web:build
npm run web:start
```

- `npm run dev`：启动 `electron-vite dev --watch`，用于完整 Electron 开发态。
- `npm run build`：执行 `tsc --noEmit && electron-vite build`，输出到 `output/build/`。
- `npm test`：运行 `vitest run`；当前基线是 33 个测试文件、200 个测试。
- `npm run test:coverage`：运行 Vitest 覆盖率（v8），输出文本、JSON 摘要与 HTML 报告到 `coverage/`。
- `npm run test:coverage` 的覆盖率只统计核心业务逻辑（`core/`、`shared/`、`main/services`、`main/repositories`、`main/adapters/sqlite`、`main/ipc` 请求校验、`main/timerSnapshotBroadcast`、`main/windowing`、`renderer` 纯逻辑、`server/rpc.ts`）；壳层/装配/视图由 E2E 覆盖，不计入单测覆盖率口径。
- `tools/badge.mjs` 读取 `coverage/coverage-summary.json` 与 `output/test-results.json`，生成 `coverage/{coverage,tests}.json`（shields endpoint 徽章数据）。
- README 的 `tests`/`coverage` 徽章用 `img.shields.io/endpoint` 读 GitHub Pages 的 JSON；由 CI 的 `badge`+`deploy-pages` job 在 main 分支生成并发布（Pages 来源需设为「GitHub Actions」）。
- `npm run test:e2e`：先构建，再启动真实 Electron，验证 renderer 沙箱与弹窗拦截、IPC 入参校验、任务创建与绑定、计时启动/暂停和重启持久化。
- `npm run preview`：预览构建后的 Electron 应用。
- `npm run package`：默认 Windows 发布链路；先构建，再通过 `package-win.mjs` 预热 Windows 打包兼容层，最后生成 `nsis + portable`，输出到 `output/release/`。
- `npm run test:package-smoke`：检查安装包、便携版和 `latest.yml` 相对 `win-unpacked` 的新鲜度，验证发布元数据，并启动打包态应用检查 preload API。
- `npm run package:appx:dev`：唯一 AppX 打包入口；内部会自动准备或复用开发证书、在需要时拉起管理员导入机器级信任、执行构建，并通过 `package-win.mjs appx` 产出当前机器可直接安装的签名 `appx`。
- `npm run web:dev`：Web 开发态。构建并启动 `server/`（API + SSE，127.0.0.1:5274），并用 Vite 启动 renderer（127.0.0.1:5273，`/api` 代理到 5274），带 HMR。
- `npm run web:build`：仅构建 Web 后端（`vite build -c vite.server.config.ts` 到 `output/build/server/`）。
- `npm run web:start`：完整 Web 入口。`npm run build` + 构建 server + `node output/build/server/index.js`，浏览器打开 http://localhost:5274。

运行 `npm run package` 前必须退出所有从 `output/release/` 启动的 FocusFlow 实例，尤其是 `output/release/win-unpacked/focusflow.exe`。运行中的 exe 会锁定该目录，导致 electron-builder 以 `EBUSY` 失败。

在浏览器打开渲染层地址时：若已运行 Web 服务（`npm run web:start` 的 5274，或 `npm run web:dev` 的 5273），`renderer/main.tsx` 会注入 Web 版 `window.focusFlow`（HTTP + SSE）并渲染完整 App；若只有静态渲染层而无 Web 后端，则相关数据请求会失败。桌面完整交互、托盘、窗口控制、preload 等请用 `npm run dev` 拉起 Electron。

### Web 服务

- 端口：API/SSE 默认 `127.0.0.1:5274`（可用 `FOCUSFLOW_WEB_PORT` / `FOCUSFLOW_WEB_HOST` 覆盖）；Web 开发渲染层 `127.0.0.1:5273`。
- 数据：默认 `%USERPROFILE%\.focusflow-web\focusflow.sqlite`（可用 `FOCUSFLOW_WEB_DATA_DIR` 覆盖）。
- 通知/提示音/主题：由浏览器客户端负责（`renderer/web/notify.ts` + 快照流）；`WindowTitleBar` 在 Web 下隐藏窗口控制按钮；`SettingsView` 在 Web 下隐藏「启动与窗口」及「关闭窗口后继续运行」。
- 鉴权：默认仅本机、无鉴权；对外暴露需自行加认证与 HTTPS。
- 桌面端数据与 Web 端数据**不共享**；不要把二者指向同一个 `focusflow.sqlite`。

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
- GitHub Release 仍由人工创建和上传产物；项目当前没有 publish 自动化，也没有应用内自动更新。
- `package.json > build.win.icon`：`main/assets/focusflow-icon.ico`
- `package.json > build.win.executableName`：`focusflow`
- `package.json > build.nsis.oneClick`：`false`，保持 `focusflow-setup.exe` 为标准辅助安装向导，而不是一键安装。
- `package.json > build.nsis.allowToChangeInstallationDirectory`：`true`，允许用户修改安装目录。
- `package.json > build.nsis.selectPerMachineByDefault`：`false`，安装模式页默认选当前用户安装。
- `package.json > build.nsis.artifactName`：`focusflow-setup.${ext}`
- `package.json > build.portable.artifactName`：`focusflow-single.${ext}`
- `package.json > build.appx.artifactName`：`focusflow-appx.${ext}`
- `package.json > build.appx`：集中定义 `identityName`、`applicationId`、`publisherDisplayName`、`publisher` 等 AppX 元数据；当前允许本地验证占位值，正式发布前必须替换。
- `package.json > build.appx.publisher` 必须与开发证书 subject 完全一致；当前本地占位发布者是 `CN=gis2all`。
- 本地开发证书脚本位于 `tools/appx/prepare-dev-cert.ps1` 和 `tools/appx/package-dev.ps1`。
- `package-win.mjs` 负责预热 `output/cache/electron-builder/`，为 legacy `winCodeSign-2.6.0` cache 提前放入现代 `rcedit`；调用 electron-builder 时固定传入 `--publish never`，防止 CI push 隐式触发发布。
- 兼容层目标是稳定 exe 图标与版本资源写入；这是项目级 workaround，不是系统权限修复。
- 本地开发证书私钥创建在 `CurrentUser\My`，但 AppX 安装信任要导入 `LocalMachine\TrustedPeople`；脚本会优先复用已有机器级信任，缺失时拉起管理员 PowerShell 完成导入。
- 本地开发证书导出文件位于 `output/dev-cert/`，包含 `.pfx`、`.cer`、密码文件和 `metadata.json`，仅用于本机验证，不提交仓库。

### 对外发布流程

- 当前正式对外分发优先使用 `focusflow-setup.exe` 和 `focusflow-single.exe`。
- `win-unpacked/` 仅用于开发者烟测，不作为正式下载项。
- `focusflow-appx.appx` 当前是开发验证链路，仍依赖本地开发证书与占位身份信息，不作为公开下载承诺。
- 手动制作公开发布建议流程：
  1. 从 `main` 拉取最新代码。
  2. 运行 `npm ci`、`npm test`。
  3. 运行 `npm run package`。
  4. 手动验证 `output/release/focusflow-setup.exe` 与 `output/release/focusflow-single.exe`。
  5. 创建 GitHub Release 并上传这两个产物。

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
- `timer:snapshot` 广播职责（桌面）由 `main/index.ts` 组合根持有；`registerIpcHandlers.ts` 只负责 handler 注册。
- Web 端：`server/index.ts` 订阅 `composition.timer.onSnapshot` 并通过 SSE 推送 `timer:snapshot`。
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
- IPC / RPC 请求校验：`main/ipc/settingsUpdateRequest.ts`
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
- malformed `settings.update` payload 会在 IPC / RPC 边界被拒绝。
- Web 端在 `SettingsView` 中隐藏「启动与窗口」（开机自启/启动到托盘）与「关闭窗口后继续运行」，这些是桌面窗口行为。

### 窗口、小窗、托盘、通知

- 主窗口和小窗编排：`main/index.ts`
- 小窗尺寸和位置：`main/windowing.ts`
- 托盘菜单：`main/trayMenu.ts`
- Windows 通知：`main/adapters/desktop.ts`、`main/adapters/notificationHelpers.ts`
- 标题栏和窗口按钮：`renderer/components/WindowTitleBar.tsx`
- 浏览器态兜底页：`renderer/BrowserEnvironmentNotice.tsx`（目前较少使用）

语义要点：

- 主窗口和小窗互斥显示。
- 小窗位置目前是进程内记忆，不启用数据库持久化。
- 关闭主窗口时根据 `closeToTray` 决定隐藏到托盘或退出。
- Windows 启动早期会调用 `app.setAppUserModelId(...)`；打包态 AUMID 是 `com.focusflow.timer`。
- Web 端 `WindowTitleBar` 隐藏最小化/最大化/关闭/小窗按钮；`system.*` 的窗口控制全部降级为客户端 no-op。

### 图标和资源

- Renderer SVG 品牌图标：`renderer/assets/icons/focusflow-icon.svg`
- Main/Windows 图标：`main/assets/focusflow-icon.png`、`main/assets/focusflow-icon.ico`
- 托盘图标：`main/assets/focusflow-tray.png`、`main/assets/focusflow-tray-dark.png`
- Web favicon：`renderer/public/favicon.svg`（构建后拷贝到产物根目录）
- 打包时通过 `package.json > build.extraResources` 将 `main/assets` 复制到运行时 `app-assets/`。
- 主窗口、通知和托盘均从运行时资源路径加载。

### Web 模式

- Web 后端：`server/index.ts`、`server/rpc.ts`、`server/composition.ts`
- Web 传输：`renderer/web/api.ts`、`renderer/web/notify.ts`
- 入口：`renderer/main.tsx` 在无 preload 时注入 `window.focusFlow = createWebFocusFlowApi()`
- 测试：`server/rpc.test.ts`（RPC 分发）；浏览器冒烟用 Playwright 脚本对 `web:start` 起的 5274 验证。

语义要点：

- 服务端进程是计时唯一权威（等同桌面主进程），用 `composition.timer.onSnapshot` + SSE 推送 `timer:snapshot`。
- Web 下 `system.*`（窗口/小窗/拖拽/关闭）全部降级为客户端 no-op；`system.getTheme()` 用 `matchMedia` + 设置解析。
- 通知/提示音：客户端收到 `status === 'completed'` 快照后按设置触发浏览器 Notification / WebAudio（服务端端口 no-op）。
- Web 端完成/删除/绑定等动作通过 `refreshTaskBoardAndStats` 即时刷新；服务端对 void 通道（`tasks:delete`/`tasks:reorder`）返回 `null`，客户端 `rpc` 对空/非 JSON 响应做容错。
- Web 端数据独立落盘在 `%USERPROFILE%\.focusflow-web\focusflow.sqlite`，与桌面端不共享。

## AI 修改路由

- 改计时规则：先看 `core/timer/timerState.ts`，再看 `main/services/timerService.ts`，最后看 renderer 展示。
- 改计时快照广播（桌面）：优先看 `main/index.ts`、`main/timerSnapshotBroadcast.ts`、`main/ipc/registerIpcHandlers.ts`。
- 改计时快照广播（Web）：看 `server/index.ts`（SSE 推送）。
- 改任务行为：先看 `main/services/taskService.ts` / `taskBoardService.ts` / `taskDeletionService.ts`，再看 repository 和 `TasksView`。
- 改统计口径：先看 `core/stats/statsAggregator.ts` 和 `main/services/statsService.ts`。
- 改设置项：先看 `shared/types.ts`、`shared/defaults.ts`、`shared/settingsValidation.ts`、`main/ipc/settingsUpdateRequest.ts`、`main/services/settingsService.ts`、`renderer/views/SettingsView.tsx`。
- 改 IPC/API：同步 `shared/contracts.ts`、`preload/index.ts`、`main/ipc/registerIpcHandlers.ts`。
- 改 Web 传输/入口：`renderer/main.tsx`、`renderer/web/api.ts`；改 Web 通知/声音：`renderer/web/notify.ts`。
- 改 Web 后端 RPC 分发：`server/rpc.ts`（channel 复用 IPC_CHANNELS），并同步 `server/rpc.test.ts`。
- 改 Web 服务（HTTP/SSE/静态/端口/数据目录）：`server/index.ts`、`server/composition.ts`、`vite.server.config.ts`、`vite.web.config.ts`、`tools/web-dev.mjs`。
- 改 Web 可访问边界（鉴权/绑定地址）：`server/index.ts` 的 `host`/`port` 与 `tools/web-dev.mjs`。
- 改窗口/托盘/小窗：优先看 `main/index.ts`、`main/windowing.ts`、`main/trayMenu.ts`。
- 改通知（桌面）：优先看 `main/adapters/notificationHelpers.ts` 和 `main/adapters/desktop.ts`。
- 改打包命名或图标：优先看 `package.json`、`package-win.mjs`、`main/packageConfig.test.ts`、`main/assets/`。
- 改 renderer 样式：优先看对应 `renderer/views/*.tsx`、同目录测试、`renderer/styles/tokens.css`。

## 验证策略

优先按改动范围选择最小有效验证：

- 纯文档：重新读取文件并搜索关键事实；通常不需要跑测试。
- 共享类型或 IPC / RPC：跑 `npm test`，必要时加 `npm run build`。
- core 计时/统计：跑对应 `core/**/*.test.ts`，再跑相关 service 测试。
- main service/repository：跑对应 `main/**/*.test.ts`。
- renderer 组件/视图：跑对应 `renderer/**/*.test.tsx` 或 `renderer/**/*.test.ts`。
- Web RPC 分发：跑 `npm test -- server/rpc.test.ts`。
- 打包配置：跑 `npm test -- main/packageConfig.test.ts`。
- 构建路径、alias、资源路径：跑 `npm run build`。
- Windows 发布产物：跑 `npm run package`，检查 `output/release/` 中安装包、单文件便携版、`win-unpacked/` 和 `latest.yml`。
- 真实 Electron 安全与主流程：跑 `npm run test:e2e`，覆盖沙箱、新窗口拒绝、IPC 校验、任务计时和重启持久化。
- 已打包产物：在 `npm run package` 成功后跑 `npm run test:package-smoke`，覆盖产物新鲜度、元数据、打包态启动和 preload API。
- AppX 打包链路：统一跑 `npm run package:appx:dev`，并检查 `output/release/` 中 `.appx` 产物与 `output/dev-cert/` 证书导出文件。
- 启动烟测：用 `output/release/focusflow-single.exe` 和 `output/release/win-unpacked/focusflow.exe` 分别验证；注意单文件版会自解包到 `%TEMP%`，可能受单实例锁影响。
- Web 服务与浏览器：`npm run web:build` 后 `node output/build/server/index.js`，用 `curl` 验证 `POST /api/rpc` 与 `GET /api/events`，再用 Playwright / 真实浏览器打开 5274，验证完整 UI、计时由 SSE 驱动、任务完成/删除/绑定即时刷新、web 下窗口按钮与桌面专属设置隐藏。

当前测试框架：`Vitest 4.1.10`（单元/组件，覆盖率配套 `@vitest/coverage-v8`）与 `Playwright 1.61.1`（真实 Electron E2E 和打包烟测）。当前 Vitest 基线是 33 个测试文件、200 个测试。

重点测试文件：

- `core/timer/timerState.test.ts`
- `core/stats/statsAggregator.test.ts`
- `main/repositories/sqliteRepositories.test.ts`
- `main/adapters/sqlite/sqliteDatabase.test.ts`
- `main/timerSnapshotBroadcast.test.ts`
- `main/ipc/registerIpcHandlers.test.ts`
- `main/ipc/requestValidation.test.ts`
- `main/ipc/settingsUpdateRequest.test.ts`
- `main/security.test.ts`
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
- `server/rpc.test.ts`
- `tools/packaged-smoke.test.mjs`

## 工作区纪律

- 可以处于脏工作区；不要回退用户已有修改。
- 提交前先看 `git status --short`，只暂存本次相关文件。
- 不要使用 `git reset --hard` 或 `git checkout --` 回退用户已有修改，除非用户明确要求。
- 不要提交 `output/`、数据库文件、coverage、本地辅助目录。
- 不要提交 `%USERPROFILE%\.focusflow-web\` 下的 Web 运行数据库（默认在用户目录）；若用 `FOCUSFLOW_WEB_DATA_DIR` 指向项目内，同样忽略 `*.sqlite*`。
- 如果遇到看似乱码的中文，先用 UTF-8 安全读取验证，不要基于 PowerShell 显示直接判断文件损坏。
