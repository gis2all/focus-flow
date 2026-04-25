# CLAUDE.md

## 项目概览

- 项目名：`FocusFlow`
- 定位：本地优先的 Windows 桌面番茄钟客户端
- 技术栈：`Electron + Vite + React + TypeScript + SQLite(sql.js)`
- 包管理器：`npm`
- 当前分支：`feature`
- 远端仓库：`git@github.com:gis2all/focus-flow.git`
- 最近一次提交：`994966a chore: polish windows tray and app icon setup`

当前阶段的工作重点仍然是：

1. 先把 V1 功能闭环做完整。
2. 再继续按参考图收敛 UI 细节。
3. 所有改动优先保持低耦合分层，不把业务规则重新塞回 React 页面。

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
- 自动切换：专注结束后自动进入休息，休息结束后可自动进入下一轮专注
- 任务管理：新增、行内编辑、完成、恢复、删除
- 任务排序：进行中任务支持拖拽排序，顺序持久化
- 当前轮任务绑定：运行中的专注可绑定或解绑当前任务
- 显式启动绑定：非运行状态下可从待办页直接“设为当前”，立即开始一轮专注并绑定该任务
- 今日统计：专注时长、完成番茄数、完成任务数、休息时长、小时分布、任务时长榜
- 桌面能力：系统托盘、关闭到托盘、Windows 通知、提示音、开机自启、启动到托盘
- 主题能力：白天 / 黑暗 / 跟随系统
- Windows 打包：`electron-builder` 已配置 `nsis` 和 `portable`
- 应用图标：项目内已接入 `resources/` 下的自定义图标资源

## 关键产品语义

这些语义已经在代码里定下来了，后续不要轻易改回去：

- 已取消“下一轮任务”持久选择模型。
- 普通计时页点击“开始专注”时，不自动绑定任何任务。
- 休息自动切回专注时，也不自动绑定任务。
- 当前这轮专注绑定哪个任务，以 `timer snapshot.taskId` 为唯一真源。
- 待办页里的“绑定 / 已绑定 / 设为当前”按钮，只处理当前轮专注，不再承担“选择下一轮任务”的语义。
- 任务行不再用持久选中态表达业务语义，行高亮仅用于 hover。
- 右侧圆环文案现在是“长休进度”，`1/4` 表示进入下一次长休前的专注轮次进度。

## 架构原则

项目采用低耦合分层，主路径是：

`core -> services -> adapters -> UI`

### `src/core`

纯业务逻辑层，不依赖 Electron、React、SQLite 具体实现。

- `timer/`：计时状态机、阶段切换、恢复规则
- `stats/`：统计聚合逻辑

这里的代码应保持可单测、可复用、可脱离桌面环境运行。

### `src/main`

Electron 主进程层，负责应用编排和桌面能力。

- `services/`
  - `TimerService`
  - `TaskService`
  - `TaskBoardService`
  - `StatsService`
  - `SettingsService`
- `repositories/`：SQLite repository 实现
- `adapters/`：桌面能力与数据库适配
- `ports/`：仓储接口与桌面接口
- `ipc/`：IPC handler 注册

主进程负责：

- 计时兜底
- 持久化协调
- 托盘与窗口控制
- 通知与提示音
- 设置读写

不要把计时规则、恢复规则、任务绑定规则重新放回渲染层。

### `src/preload`

仅通过 `contextBridge` 暴露有限 API，隔离 Electron 与渲染层。

### `src/renderer`

React 渲染层，只负责界面、交互和展示状态。

- `views/`
  - `TimerView`
  - `TasksView`
  - `StatsView`
  - `SettingsView`
- `components/`：通用 UI 组件
- `styles/`：全局样式和设计 token

### `src/shared`

共享合同层，集中维护：

- 共享类型
- IPC channel
- 默认值

避免前后端散落字符串和重复类型定义。

## 当前数据模型

SQLite 当前核心表：

- `tasks`
  - 任务标题
  - 完成状态
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
- `app_events`
  - 关键事件日志，用于恢复与排查

当前不再使用：

- `selectedTaskId`
- `tasks.select`
- `TaskSelectionService`
- `TaskSelectionRepository`
- “下一轮任务”持久状态表

注意：

- 如果历史 session 仍引用已删除任务，部分 UI 会使用“已删除任务”兜底。
- 今日统计里的任务榜单，当前按“今天已完成的 focus session + 当前仍存在的任务”聚合。

## IPC 能力概览

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

### `system`

- `getTheme`
- `showWindow`
- `minimizeWindow`
- `toggleMaximizeWindow`
- `closeWindow`
- `quit`

## 界面与桌面实现现状

### 主窗口

- 默认窗口尺寸：`800x600`
- 最小尺寸：`800x600`
- 当前使用无原生边框窗口：`frame: false`
- 窗口标题：`FocusFlow`
- 自定义窗口控制按钮在渲染层实现

### 托盘

- 当前使用系统原生托盘菜单
- 不再使用自定义托盘面板
- 托盘点击会显示主窗口
- 关闭窗口时如果开启了“关闭到托盘”，应用会隐藏而不是退出
- 正在计时时退出会弹确认

### 图标

项目内图标资源位于：

- [focusflow-icon.svg](D:/Code/pomodoro-timer/resources/focusflow-icon.svg)
- [focusflow-icon.png](D:/Code/pomodoro-timer/resources/focusflow-icon.png)
- [focusflow-icon.ico](D:/Code/pomodoro-timer/resources/focusflow-icon.ico)
- [focusflow-tray.png](D:/Code/pomodoro-timer/resources/focusflow-tray.png)

打包时通过 `package.json` 的 `extraResources` 复制到 `app-assets/`，主窗口和托盘均从运行时资源路径加载。

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

## 待办页现状

待办页当前已经不是 demo 列表，而是真实数据驱动。

已实现：

- 三个标签：全部 / 进行中 / 已完成
- 进行中任务拖拽排序
- 行内编辑
- 每任务番茄数和专注时长
- 当前轮绑定按钮
- 删除确认与解绑确认

当前语义：

- 左侧 checkbox 只表示完成 / 恢复
- 绑定按钮只表示“当前轮绑定”
- 删除是独立危险操作
- 不再保留“下一轮任务”说明文案

## 统计页现状

当前主要完成的是“今天”页的信息架构重排。

包括：

- 顶部指标卡
- 今日专注分布
- 时间构成
- 任务时长列表

当前任务时长区域的统计口径：

- 只看今天
- 只统计已完成的 `focus` session
- 只保留当前仍存在的任务

## 本地开发命令

```powershell
npm run dev
npm run build
npm run preview
npm test
npm run package
```

说明：

- `npm run dev`：启动 Electron + Vite 开发环境
- `npm run build`：执行 TypeScript 检查并构建产物
- `npm test`：运行 Vitest
- `npm run package`：生成 Windows 安装包和便携版，输出到 `release/`

Windows / PowerShell 注意事项：

- 如果 Electron 误以 Node 模式启动，先执行：`Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue`
- 编辑 `md / ts / tsx / json` 时优先用安全 UTF-8 写法，避免 PowerShell 编码问题
- `scripts/` 当前已加入 `.gitignore`，默认不提交

## 测试现状

当前测试框架：`vitest`

已有测试覆盖：

- [timerState.test.ts](D:/Code/pomodoro-timer/src/core/timer/timerState.test.ts)
- [statsAggregator.test.ts](D:/Code/pomodoro-timer/src/core/stats/statsAggregator.test.ts)
- [sqliteRepositories.test.ts](D:/Code/pomodoro-timer/src/main/repositories/sqliteRepositories.test.ts)
- [settingsService.test.ts](D:/Code/pomodoro-timer/src/main/services/settingsService.test.ts)
- [statsService.test.ts](D:/Code/pomodoro-timer/src/main/services/statsService.test.ts)
- [taskBoardService.test.ts](D:/Code/pomodoro-timer/src/main/services/taskBoardService.test.ts)
- [taskService.test.ts](D:/Code/pomodoro-timer/src/main/services/taskService.test.ts)
- [timerService.test.ts](D:/Code/pomodoro-timer/src/main/services/timerService.test.ts)
- [viewModel.test.ts](D:/Code/pomodoro-timer/src/renderer/src/viewModel.test.ts)
- [SettingsView.test.tsx](D:/Code/pomodoro-timer/src/renderer/src/views/SettingsView.test.tsx)
- [StatsView.test.tsx](D:/Code/pomodoro-timer/src/renderer/src/views/StatsView.test.tsx)
- [TasksView.test.tsx](D:/Code/pomodoro-timer/src/renderer/src/views/TasksView.test.tsx)
- [TimerView.test.tsx](D:/Code/pomodoro-timer/src/renderer/src/views/TimerView.test.tsx)

最近一次已确认的验证结果：

- `npm test`：`67 passed`
- `npm run build`：通过

## 打包信息

- 打包工具：`electron-builder`
- `appId`：`com.focusflow.timer`
- `productName`：`FocusFlow`
- Windows targets：`nsis`、`portable`
- 输出目录：`release/`

## 协作约定

- 优先保持分层清晰，不要把业务规则重新塞回 React 组件
- 共享类型和 IPC 合同统一维护在 `src/shared`
- 涉及计时逻辑时，先看 `src/core/timer` 和 [timerService.ts](D:/Code/pomodoro-timer/src/main/services/timerService.ts)
- 涉及待办聚合逻辑时，先看 [taskBoardService.ts](D:/Code/pomodoro-timer/src/main/services/taskBoardService.ts)
- 涉及统计口径时，先看 [statsAggregator.ts](D:/Code/pomodoro-timer/src/core/stats/statsAggregator.ts) 和 [statsService.ts](D:/Code/pomodoro-timer/src/main/services/statsService.ts)
- 新增桌面能力优先走 `src/main/adapters` / `src/main/ports`
- 数据访问尽量走 repository，不要在 service 外直接写 SQL
- 渲染层只依赖 preload 暴露的 API，不直接触碰 Electron 主进程对象
- 不要使用 `git reset --hard` 或 `git checkout --` 回退用户已有修改，除非用户明确要求

## 接手顺序

新一轮开发或新同事接手时，建议按这个顺序熟悉项目：

1. 看 [package.json](D:/Code/pomodoro-timer/package.json)，确认命令和打包方式
2. 看 [types.ts](D:/Code/pomodoro-timer/src/shared/types.ts) 和 [contracts.ts](D:/Code/pomodoro-timer/src/shared/contracts.ts)，理解共享合同
3. 看 [index.ts](D:/Code/pomodoro-timer/src/main/index.ts) 和 `src/main/services/`，理解主进程编排
4. 看 `src/renderer/src/views/`，理解页面拆分
5. 最后跑 `npm test` 和 `npm run build`，确认工作树健康
