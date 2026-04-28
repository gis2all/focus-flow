# CLAUDE.md

## 项目概览

- 项目名：`FocusFlow`
- 定位：本地优先的 Windows 桌面番茄钟客户端
- 技术栈：`Electron 34 + electron-vite 5 + React 19 + TypeScript 5 + SQLite(sql.js) + electron-log`
- 包管理器：`npm`
- 远端仓库：`git@github.com:gis2all/focus-flow.git`
- 本地数据库：运行时创建在 `app.getPath('userData')/focusflow.sqlite`
- 最近一次提交：请以 `git log -1 --oneline` 的实时结果为准

当前阶段的工作重点：

1. 先把 V1 功能闭环做完整。
2. 再继续按参考图收敛 UI 细节。
3. 所有改动优先保持低耦合分层，不把业务规则重新塞回 React 页面。

最近已落地到当前工作区的进展：

- 统计页已经切成 `今天 / 日历` 双 tab：
  - 今天页保留顶部指标、小时分布、时间构成和底部专注时长榜单
  - 日历页按月展示热力图，并支持点击日期查看当日专注时长明细
  - 底部专注时长榜单里，`未绑定专注` 作为独立排行项参与排序
- 待办页任务行已经带上完成日期列：
  - 已完成任务显示本地自然日 `MM-DD`
  - 进行中任务留空
  - 长标题 tooltip 只在实际溢出时出现
- 计时页顶部“第 N 个番茄钟”和底部“已专注 X 个番茄钟”已经切到任务/未绑定双口径显示：
  - 绑定任务时按任务自己的 `completedPomodoros`
  - 未绑定时按独立的 `unboundFocusCount`
  - 短休 / 长休阶段沿用刚完成那轮 focus 的任务上下文
  - 短休 / 长休 / 自动切换节奏仍然继续按全局 `focusCount`
- `timer_runtime.state_json` 已经兼容新的显示字段 `unboundFocusCount` 和 `lastFocusTaskId`，旧 runtime JSON 缺字段时会以 `0 / null` 默认值恢复
- 小窗顶部拖动区与返回主窗口按钮当前使用中文 `aria-label`，小窗状态区现在只保留文字，不再显示蓝色 badge / halo / core 装饰
- 主窗口默认 / 最小高度已按当前运行时实测的 `760` 逻辑像素固定，代码里保留了为什么要按 125% 缩放实测值换算的注释

## 当前产品范围

V1 不做：

- 账号体系
- 云同步
- 团队协作
- 插件系统
- 移动端
- 复杂项目分类

V1 当前已实现或已落地到代码的核心能力：

- 番茄钟阶段：`专注 / 短休 / 长休`
- 计时控制：开始、暂停、继续、跳过、重置
- 自动切换：专注结束后可自动进入休息，休息结束后可自动进入下一轮专注
- 任务管理：新增、行内编辑、完成、恢复、删除、完成日期列
- 任务排序：进行中任务支持拖拽排序，顺序持久化
- 当前轮任务绑定：运行中的专注可绑定或解绑当前任务
- 显式启动绑定：非运行状态下可从待办页直接“设为当前”，立即开始一轮专注并绑定该任务
- 风险确认：`running / paused` 状态下，结束当前 session 的前端入口会弹确认框
- 统计页：今天统计、月历热力图、选中日专注时长明细、小时分布、时间构成、专注时长榜（含未绑定专注）
- 桌面能力：系统托盘、关闭到托盘、启动到托盘、开机自启、Windows 通知、提示音
- 窗口能力：主窗口 + 小窗模式，二者互斥显示
- 主题能力：白天 / 黑暗 / 跟随系统
- 单实例运行：通过 `app.requestSingleInstanceLock()` 保证不允许多实例常驻
- Windows 打包：`electron-builder` 已配置 `nsis` 和 `portable`
- `npm run package` 会先通过 `package-win.mjs` 走一层项目级打包兼容层：预热 `output/cache/electron-builder` 下的私有 builder cache，并为 `winCodeSign-2.6.0` 提前放入现代 `rcedit`
- 这层兼容的目标只是让 Windows 打包时的 exe 图标与版本资源写入稳定可用；它不是系统权限修复，也不依赖本机开启符号链接相关权限
- 如果后续 `electron-builder` upstream 不再依赖这条旧 `winCodeSign` 路径，再评估是否删除这层兼容 helper
- 应用图标：项目内已按用途拆分到 `renderer/assets/` 与 `main/assets/`

## 关键产品语义

这些语义已经在代码里定下来了，后续不要轻易改回去：

- 已取消“下一轮任务”持久选择模型。
- 普通计时页点击“开始专注”时，不自动绑定任何任务。
- 休息自动切回专注时，也不自动绑定任务。
- 当前这轮专注绑定哪个任务，以 `timer snapshot.taskId` 为唯一真源。
- 待办页里的“绑定 / 已绑定 / 设为当前”按钮，只处理当前轮专注，不再承担“选择下一轮任务”的语义。
- `设为当前` 在当前 session 为 `running / paused` 且会打断当前计时时，走和计时页相同的风险确认。
- 计时页里的 `开始专注 / 跳过 / 短休 / 长休` 在 `running / paused` 时也需要先确认。
- `idle / completed` 状态不弹风险确认，直接执行操作。
- 待办页当前标签页状态由 `App.tsx` 持有，切去别的页面再回来时会保留上次的 `全部 / 进行中 / 已完成` 选择。
- 计时页顶部“第 N 个番茄钟”和底部“已专注 X 个番茄钟”当前是显示口径，不再直接等于全局 `focusCount`。
- 绑定任务时，番茄钟显示口径基于任务自己的 `completedPomodoros`；focus 阶段显示“下一个番茄钟序号”，休息阶段沿用 `lastFocusTaskId`。
- 未绑定时，番茄钟显示口径基于 `snapshot.unboundFocusCount`；绑定任务、解绑任务和 reset 都会把这部分未绑定显示计数清零。
- 全局 `focusCount` 继续只承担流程节奏语义：短休 / 长休判定、长休进度与自动切换都仍然以它为准。
- 非设置页的标签型时长统一走 renderer 的 `formatDurationLabel`；设置页的步进器和单位文案继续保留中文 `分钟 / 轮`。
- 右下角“长休进度”圆环的进度显示在渲染层做本地时间插值：
  - `running` 时基于 `startedAt / targetEndAt / durationMs` 连续平滑推进
  - `paused / idle / completed` 时回退到快照静态值
- 大号倒计时数字仍然按快照刷新，不做毫秒级滚动。
- 小窗位置只在当前应用进程存活期间记忆；应用彻底退出后，下次打开会回到默认右下角位置。

## 架构原则

项目采用低耦合分层，主路径是：

`core -> services -> adapters -> UI`

### `core`

纯业务逻辑层，不依赖 Electron、React、SQLite 具体实现。

- `timer/`：计时状态机、阶段切换、恢复规则
- `stats/`：统计聚合逻辑

这里的代码应保持可单测、可复用、可脱离桌面环境运行。

### `main`

Electron 主进程层，负责应用编排和桌面能力。

- `index.ts`：应用启动、数据库初始化、服务装配、窗口/托盘编排
- `windowing.ts`：主窗口/小窗切换、小窗尺寸、默认位置、激活逻辑
- `trayMenu.ts`：托盘菜单模板
- `services/`
  - `TimerService`
  - `TaskService`
  - `TaskBoardService`
  - `StatsService`
  - `SettingsService`
- `repositories/`：SQLite repository 实现
- `adapters/`：桌面能力、数据库适配与通知帮助函数
- `ports/`：仓储接口与桌面接口
- `ipc/`：IPC handler 注册

主进程负责：

- 计时兜底
- 持久化协调
- 托盘与窗口控制
- 通知与提示音
- 小窗尺寸与拖动约束
- 设置读写

不要把计时规则、恢复规则、任务绑定规则重新放回渲染层。

### `preload`

仅通过 `contextBridge` 暴露有限 API，隔离 Electron 与渲染层。

统一暴露在 `window.focusFlow` 下，不让 renderer 直接碰 Electron 对象。

### `renderer`

React 渲染层，只负责界面、交互和展示状态。

- 单一 renderer 入口，通过 URL query 参数区分 `window=main` 与 `window=mini`
- `renderer/main.tsx` 会先判断 `window.focusFlow` 是否存在；普通浏览器直接打开 `http://localhost:5173/` 时会渲染 `BrowserEnvironmentNotice` 提示页，避免白屏，完整应用仍需通过 Electron 窗口运行
- `App.tsx` 负责：
  - 订阅 `timer snapshot`
  - 切主窗口/小窗渲染模式
  - 持有待办页当前 tab 状态
  - 持有统计页当前 tab、选中月份和选中日期状态
  - 维护长休圆环的平滑显示进度
- `views/`
  - `TimerView`
  - `TasksView`
  - `StatsView`
  - `SettingsView`
  - `MiniTimerView`
- `components/`：通用 UI 组件
- `viewModel.ts`：格式化、任务视图映射、平滑进度等 renderer helper

### `shared`

共享合同层，集中维护：

- 共享类型
- IPC channel
- 默认值
- 小窗尺寸常量

避免前后端散落字符串和重复类型定义。

## 当前数据模型与持久化

SQLite 当前核心表：

- `tasks`
  - 任务标题
  - 完成状态
  - `completedAt`（完成时间，用于完成日期列和完成统计）
  - 创建 / 更新时间
  - `sort_order`
- `timer_sessions`
  - 阶段类型
  - 任务绑定
  - 开始 / 结束时间
  - 实际时长
  - 是否完成
  - 完成原因
- `settings`
  - 应用设置
- `timer_runtime`
  - 当前计时器运行快照，用于恢复
  - `state_json` 中当前包含显示口径相关字段 `focusCount`、`unboundFocusCount`、`lastFocusTaskId`
- `app_events`
  - 关键事件日志，用于恢复与排查

共享类型里，和当前 UI / 统计直接相关的几个形状是：

- `TaskBoardItem` / `TaskRowModel` 都带 `completedAt`
- `FocusStats` 里的专注时长榜单使用 `taskFocusMinutes` 和 `unboundFocusMinutes`
- `MonthStats` / `CalendarDayStats` 负责月历聚合；`CalendarDayStats` 额外带 `taskFocusMinutes`、`unboundFocusMinutes`
- `MonthStatsRequest` 为 `{ year, month }`，通过 `stats.getMonth` 拉取指定月份

当前不再使用：

- `selectedTaskId`
- `tasks.select`
- `TaskSelectionService`
- `TaskSelectionRepository`
- “下一轮任务”持久状态表

当前设置字段：

- `focusMinutes`
- `shortBreakMinutes`
- `longBreakMinutes`
- `longBreakInterval`
- `autoStartBreaks`
- `autoStartFocus`
- `notificationsEnabled`
- `soundEnabled`
- `openAtLogin`
- `startToTray`
- `closeToTray`
- `themePreference`

注意：

- 如果历史 session 仍引用已删除任务，部分 UI 会使用“已删除任务”兜底。
- 今日统计里的专注时长榜单，当前按“今天完成的任务 + 今天已完成的 focus session + 当前仍存在的任务”聚合。
- 今日统计里的专注时长榜单只保留分钟数大于 0 的项目，并按分钟数降序展示全部符合条件的任务和 `未绑定专注`。
- 小窗位置当前不入库、不进设置表，只保存在主进程内存变量 `lastMiniWindowPosition`。

## IPC / Preload 能力概览

渲染层统一通过 `window.focusFlow` 调用这些能力。

### `timer`

- `getSnapshot`
- `start`
- `bindCurrentTask`
- `pause`
- `resume`
- `skip`
- `reset`
- `onSnapshot`

### `tasks`

- `getBoard`
- `list`
- `create`
- `update`
- `complete`
- `restore`
- `reorder`
- `delete`

### `settings`

- `get`
- `update`

### `stats`

- `get`
- `getMonth`

### `system`

- `getTheme`
- `showWindow`
- `showMiniWindow`
- `beginWindowDrag`
- `updateWindowDrag`
- `endWindowDrag`
- `resizeWindow`
- `minimizeWindow`
- `toggleMaximizeWindow`
- `closeWindow`
- `quit`

## 界面与桌面实现现状

### 主窗口

- 当前启动尺寸（`BrowserWindow` 逻辑尺寸）：`888x760`
- 当前最小尺寸（`BrowserWindow` 逻辑尺寸）：`888x760`
- 当前使用无原生边框窗口：`frame: false`
- 窗口标题：`FocusFlow`
- 自定义窗口控制按钮在渲染层实现
- 主窗口关闭时：
  - 如果 `closeToTray=true`，则隐藏到托盘
  - 否则走退出流程
- 如果当前有正在运行的计时，退出前会弹确认框
- 第二次启动实例时，不再新开窗口，而是聚焦当前偏好的可见窗口

### 小窗

- 固定尺寸：`162x98`
- 固定边距：首次默认出现在主显示器工作区右下角，距离边缘 `24px`
- 固定窗口属性：
  - `frame: false`
  - `transparent: true`
  - `thickFrame: false`
  - `alwaysOnTop: true`
  - `skipTaskbar: true`
  - `resizable: false`
- 小窗与主窗口互斥显示：
  - `showMiniWindow()`：隐藏主窗口并显示小窗
  - `showWindow()`：销毁/关闭小窗并显示主窗口
- 小窗关闭行为不是退出应用；`Alt+F4` 或关闭按钮都会回到主窗口
- 小窗位置只在当前进程内记忆；切回主窗口前会保存最后一次位置
- 小窗拖动不依赖原生标题栏，使用 renderer 指针事件 + `system.begin/update/endWindowDrag`
- 小窗顶部状态文案前已去掉蓝色 badge / halo / core 装饰，只保留文字
- 小窗内容只保留：
  - 顶部拖动按钮
  - 返回主窗口按钮
  - 状态文案
  - 大号倒计时
- 小窗不显示侧边栏、任务标题、控制按钮、长休进度圆环
- 小窗文本默认不可选中

### 托盘

- 当前使用系统原生托盘菜单
- 不再使用自定义托盘面板
- 托盘点击会显示主窗口
- 托盘菜单始终包含并始终可点击：
  - `显示主窗口`
  - `显示小窗`
  - `开始专注`
  - `暂停计时`
  - `跳过当前阶段`
  - `退出`
- 托盘图标会根据系统深浅色切换 `main/assets/focusflow-tray.png / main/assets/focusflow-tray-dark.png`

### Windows 通知

- Windows 启动早期会调用 `app.setAppUserModelId(...)`
- 打包态 AUMID：`com.focusflow.timer`
- 开发态 AUMID：`process.execPath`
- 系统通知文案当前固定为：
  - `focus` 完成：`专注结束 / 该休息一下了。`
  - `shortBreak` / `longBreak` 完成：`休息结束 / 准备开始下一轮专注。`
- 通知图标复用 `main/assets/focusflow-icon.png`
- 点击通知后会恢复并聚焦主窗口
- `notificationsEnabled=false` 时不发系统通知
- `soundEnabled=false` 时只静音提示音，不影响系统通知本身

### 图标

项目内图标资源位于：

- `renderer/assets/icons/focusflow-icon.svg`
- `main/assets/focusflow-icon.png`
- `main/assets/focusflow-icon.ico`
- `main/assets/focusflow-tray.png`
- `main/assets/focusflow-tray-dark.png`

打包时通过 `package.json` 的 `extraResources` 将 `main/assets` 复制到 `app-assets/`，主窗口、通知和托盘均从运行时资源路径加载。

## 计时页现状

- 顶部状态文案使用 `phaseLabel`：
  - `focus` -> `专注中`
  - `shortBreak` -> `短休息`
  - `longBreak` -> `长休息`
- 主按钮文案规则：
  - `paused + focus` -> `继续专注`
  - `paused + break` -> `继续休息`
  - 其他状态 -> `开始专注`
- 当前任务标题来源于 `snapshot.taskId` 与任务标题映射：
  - 绑定存在 -> 对应任务名
  - 绑定已删 -> `已删除任务`
  - `focus + idle` -> `当前尚未开始专注`
  - 其他未绑定阶段 -> `当前阶段未绑定任务`
- 当前任务卡片不再显示“当前任务”前缀，也不再显示“预计专注”；当前只显示任务标题和 `已专注：X 个番茄钟`。
- 顶部“第 N 个番茄钟”和底部“已专注 X 个番茄钟”来自 renderer 层派生的 `pomodoroDisplay`：
  - 绑定任务 -> 基于任务 `completedPomodoros`
  - 未绑定 -> 基于 `snapshot.unboundFocusCount`
  - 休息阶段 -> 优先沿用 `snapshot.lastFocusTaskId`，找不到任务时回退到未绑定口径
- 长休进度右下角圆环：
  - 文案为 `长休进度`
  - 数字为 `{longBreakProgress}/{longBreakInterval}轮`
  - `longBreakProgress` 基于 `focusCount % longBreakInterval` 计算
- 计时风险确认弹窗当前覆盖：
  - `开始专注`
  - `跳过`
  - `短休`
  - `长休`

## 待办页现状

待办页当前已经不是 demo 列表，而是真实数据驱动。

已实现：

- 三个标签：`进行中 / 已完成 / 全部`
- 当前标签页状态在页面切换后保持不丢失
- 进行中任务拖拽排序
- 行内编辑
- 每任务番茄数和专注时长
- 完成日期列：已完成任务显示本地自然日 `MM-DD`
- 长标题 tooltip：仅在标题实际溢出时出现，并复用任务 tooltip 样式
- 当前轮绑定按钮
- 删除确认、解绑确认、打断当前计时确认

当前语义：

- 左侧 checkbox 只表示完成 / 恢复
- `绑定` / `已绑定` 只表示“当前轮绑定”
- `设为当前` 表示“立即开始并绑定一轮新的专注”
- 删除是独立危险操作
- 不再保留“下一轮任务”说明文案

## 统计页现状

当前统计页已经有 `今天 / 日历` 双 tab。

### 今天

- 顶部指标卡
- 今日专注分布
- 时间构成
- 底部专注时长榜单

### 日历

- 按月查看的专注热力图
- 默认显示当前月
- 按本地自然日聚合
- 点击日期后在下方显示该日专注时长明细
- 未来日期禁用

当前专注时长榜单的统计口径：

- 今天页只看今天完成的任务和今天已完成的 `focus` session
- 日历选中日明细按选中本地自然日使用同类口径
- `未绑定专注` 作为独立项目参与排序
- 只保留当前仍存在且分钟数大于 0 的任务 / 项目
- 列表按分钟数降序展示全部符合条件的任务和 `未绑定专注`
- 日历下方的当日专注时长明细默认展示今天，点击具体日期后切换到该日

## 设置页现状

设置页当前是一个长页面，不再有内容区二级 tab。

分组顺序：

1. 基础体验
2. 计时节奏
3. 阶段切换
4. 启动与窗口
5. 外观

当前交互约束：

- 下拉框为自定义控件，不使用原生 `select`
- 数字调整为自定义步进器，不使用原生数字输入箭头
- `完成短休 / 长休后` 合并为一项，映射 `autoStartFocus`
- `完成专注后` 映射 `autoStartBreaks`
- 全局滚动条已改为项目自定义样式

## 本地开发命令

```powershell
npm run dev
npm run build
npm run preview
npm test
npm run package
```

说明：

- `npm run dev`：启动 `electron-vite dev --watch`
- `npm run build`：执行 `tsc --noEmit && electron-vite build`
- `npm test`：运行 `vitest run`
- `npm run package`：先构建，再通过 `package-win.mjs` 预热 Windows 打包兼容层，最后生成安装包和便携版，输出到 `output/release/`
- 直接在普通浏览器打开 `http://localhost:5173/` 时，只会看到 renderer 的浏览器态提示页；要验证完整交互、托盘、窗口控制和 preload API，请使用 `npm run dev` 拉起 Electron

Windows / PowerShell 注意事项：

- `npm run dev` 和 `npm run preview` 会自动清理 `ELECTRON_RUN_AS_NODE`，避免 Electron 误以 Node 模式启动
- 如果需要手动执行 `electron.exe .` 或从当前终端直接拉起 Electron，可先执行：`Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue`
- 编辑 `md / ts / tsx / json` 时优先用安全 UTF-8 写法，避免 PowerShell 编码问题
- 本地辅助目录和产物默认不提交：`.learnings`、`.codex-log`、`.codex-logs`、`.superpowers`、`docs/`、`output/`、`coverage/`
- 本地数据库文件默认忽略：`*.sqlite`、`*.sqlite-shm`、`*.sqlite-wal`

## 测试现状

当前测试框架：`vitest`

已有测试覆盖：

- `core/timer/timerState.test.ts`
- `core/stats/statsAggregator.test.ts`
- `main/trayMenu.test.ts`
- `main/windowing.test.ts`
- `main/adapters/notificationHelpers.test.ts`
- `main/packageConfig.test.ts`
- `main/repositories/sqliteRepositories.test.ts`
- `main/services/settingsService.test.ts`
- `main/services/statsService.test.ts`
- `main/services/taskBoardService.test.ts`
- `main/services/taskService.test.ts`
- `main/services/timerService.test.ts`
- `renderer/timerActionConfirmation.test.ts`
- `renderer/main.test.tsx`
- `renderer/viewModel.test.ts`
- `renderer/windowMode.test.ts`
- `renderer/components/ConfirmModal.test.tsx`
- `renderer/components/WindowTitleBar.test.tsx`
- `renderer/views/MiniTimerView.test.tsx`
- `renderer/views/SettingsView.test.tsx`
- `renderer/views/StatsView.test.tsx`
- `renderer/views/TasksView.test.tsx`
- `renderer/views/TimerView.test.tsx`

说明：

- 测试总数和通过数请以实时执行 `npm test` 的结果为准，不要在文档里写死。
- 构建结果请以实时执行 `npm run build` 的结果为准。

## 打包信息

- 打包工具：`electron-builder`
- `appId`：`com.focusflow.timer`
- `productName`：`FocusFlow`
- Windows targets：`nsis`、`portable`
- 输出目录：`output/release/`
- 产物文件名模式：安装包 `focusflow-setup.exe`，便携版 `focusflow.exe`，`win-unpacked/` 主程序 `focusflow.exe`
- Windows 打包兼容层：`package-win.mjs` 会预热 `output/cache/electron-builder/`，为 legacy `winCodeSign-2.6.0` cache 提前放入现代 `rcedit`
- 兼容层边界：这是项目级 workaround，用来稳定 exe 图标与版本资源写入；不是系统权限修复
- Windows 图标：`main/assets/focusflow-icon.ico`
- 运行时额外资源：`focusflow-icon.png`、`focusflow-icon.ico`、`focusflow-tray.png`、`focusflow-tray-dark.png`

## 协作约定

- 优先保持分层清晰，不要把业务规则重新塞回 React 组件
- 共享类型和 IPC 合同统一维护在 `shared`
- 涉及计时逻辑时，先看 `core/timer` 和 `main/services/timerService.ts`
- 涉及待办聚合逻辑时，先看 `main/services/taskBoardService.ts`
- 涉及统计口径时，先看 `core/stats/statsAggregator.ts` 和 `main/services/statsService.ts`
- 涉及小窗切换、位置、尺寸与拖动时，先看 `main/windowing.ts`、`main/ipc/registerIpcHandlers.ts`、`renderer/views/MiniTimerView.tsx`
- 涉及托盘行为时，先看 `main/trayMenu.ts` 和 `main/index.ts`
- 涉及 Windows 通知时，先看 `main/adapters/notificationHelpers.ts` 与 `main/adapters/desktop.ts`
- 新增桌面能力优先走 `main/adapters` / `main/ports`
- 数据访问尽量走 repository，不要在 service 外直接写 SQL
- 渲染层只依赖 preload 暴露的 API，不直接触碰 Electron 主进程对象
- 不要使用 `git reset --hard` 或 `git checkout --` 回退用户已有修改，除非用户明确要求

## 接手顺序

新一轮开发或新同事接手时，建议按这个顺序熟悉项目：

1. 看 `package.json` 和 `package-win.mjs`，确认命令、依赖、打包方式和 Windows 打包兼容层
2. 看 `shared/types.ts`、`shared/contracts.ts`、`shared/defaults.ts`、`shared/windowMetrics.ts`，理解共享合同
3. 看 `main/index.ts`、`main/windowing.ts`、`main/trayMenu.ts` 和 `main/services/`，理解主进程编排
4. 看 `preload/index.ts`，确认 renderer 能调哪些系统能力
5. 看 `renderer/main.tsx`、`renderer/App.tsx`、`renderer/views/` 和 `renderer/viewModel.ts`，理解页面入口、浏览器降级页、主界面拆分与展示逻辑
6. 最后按需执行 `npm test` 和 `npm run build`，确认工作树健康
