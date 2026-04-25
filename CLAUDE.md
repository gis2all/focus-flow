# CLAUDE.md

## 项目概览

- 项目名：`FocusFlow`
- 定位：本地优先的 Windows 桌面番茄钟客户端
- 技术栈：`Electron + Vite + React + TypeScript + SQLite(sql.js)`
- 包管理器：当前仓库使用 `npm` 和 `package-lock.json`
- 当前分支：`feature`
- 远端仓库：`git@github.com:gis2all/focus-flow.git`
- 最近本地提交：`382b2dd feat: refine task binding workflow`
- 当前重点：先补齐 V1 功能闭环，再继续做 UI 1:1 还原

## 当前产品范围

V1 是单机桌面效率工具，不做账号、云同步、团队协作、插件、移动端和复杂项目分类。

已覆盖或正在完善的能力：

- 番茄钟：专注、短休、长休、开始、暂停、恢复、跳过、重置。
- 自动切换：专注结束后可自动进入休息，休息结束后可自动进入下一轮专注。
- 任务管理：新增、行内编辑、完成、恢复、删除、进行中任务拖拽排序。
- 当前任务绑定：待办页可把正在运行的专注 session 绑定到某个进行中任务，也可解绑。
- 显式启动绑定：非运行专注时，待办页“设为当前”会启动一轮专注并绑定该任务。
- 统计：今日汇总、时间分布、任务排行、已删除任务兜底展示。
- 桌面能力：系统托盘、关闭到托盘、隐藏启动、Windows 通知、提示音、运行中退出确认。
- 设置：专注/短休/长休时长、长休间隔、通知、声音、开机自启、启动到托盘、关闭到托盘、主题偏好。

重要语义：

- 已取消“下一轮任务”持久选择模型。
- 普通计时页点击“开始”不会自动绑定任务。
- 休息自动进入下一轮专注时不会自动绑定任务。
- 当前轮真实绑定任务以 `timer snapshot.taskId` 为唯一真源。
- 待办页按钮只影响当前轮绑定，不再通过行点击选择下一轮任务。
- 右侧圆环文案为“长休进度”，`1/4` 表示长休周期内的番茄钟进度。

## 架构原则

项目按低耦合分层组织，核心方向是 `core -> services -> adapters -> UI`。

### `src/core`

纯业务逻辑层，不依赖 Electron、React 或数据库实现。

- `timer/`：计时状态机、阶段切换、恢复逻辑。
- `stats/`：统计聚合逻辑。

这一层应保持可单测、可复用、可脱离桌面环境运行。

### `src/main`

Electron 主进程层，负责应用编排和桌面能力。

- `services/`：`TimerService`、`TaskService`、`TaskBoardService`、`StatsService`、`SettingsService`。
- `repositories/`：SQLite repository 实现。
- `adapters/`：桌面能力与 SQLite 适配。
- `ports/`：仓储接口与桌面接口定义。
- `ipc/`：IPC handler 注册。

主进程承担计时兜底、持久化协调和桌面能力。不要把核心计时规则放回 React 页面。

### `src/preload`

只通过 `contextBridge` 暴露有限 API，避免渲染层直接接触 Electron 或 Node 能力。

### `src/renderer`

React 渲染层，只负责界面、交互和展示状态。

- `components/`：应用外壳、标题栏、图标组件。
- `views/`：`TimerView`、`TasksView`、`StatsView`、`SettingsView`。
- `styles/`：设计 token 与全局样式。

### `src/shared`

共享合同层，集中维护前后端共用类型、默认值和 IPC 合同，避免字符串散落。

## 数据模型

SQLite schema 当前包含：

- `tasks`：任务标题、完成状态、创建/更新时间、`sort_order`。
- `timer_sessions`：每次专注/休息记录、任务绑定、阶段类型、起止时间、实际时长、完成状态。
- `settings`：用户设置。
- `timer_runtime`：当前计时器运行快照，用于恢复。
- `app_events`：关键事件日志，用于恢复与排查。

注意：

- 不再使用 `app_state.selected_task_id`。
- 旧数据库里如果残留 `selected_task_id`，代码会忽略，不做破坏性迁移。
- 统计任务名称时，如果 session 引用了已删除任务，UI 使用“已删除任务”兜底。

## IPC 能力概览

当前共享合同主要包括：

- `timer`
  - `getSnapshot`
  - `start`
  - `bindCurrentTask`
  - `pause`
  - `resume`
  - `skip`
  - `reset`
  - `onSnapshot`
- `tasks`
  - `getBoard`
  - `list`
  - `create`
  - `update`
  - `complete`
  - `restore`
  - `reorder`
  - `delete`
- `settings`
  - `get`
  - `update`
- `stats`
  - `get`
- `system`
  - `getTheme`
  - `showWindow`
  - `minimizeWindow`
  - `toggleMaximizeWindow`
  - `closeWindow`
  - `quit`

已移除：

- `tasks.select`
- `TaskSelectionService`
- `TaskSelectionRepository`
- `TaskBoardSnapshot.selectedTaskId`

## 本地开发命令

```bash
npm run dev
npm run build
npm run preview
npm test
npm run package
```

说明：

- `npm run dev`：启动 Electron + Vite 开发环境。
- `npm run build`：执行 TypeScript 检查并构建 Electron/Vite 输出。
- `npm test`：运行 Vitest。
- `npm run package`：生成 Windows 安装包和便携版，输出到 `release/`。

Windows 启动注意：

- 如果 Electron 异常以 Node 模式启动，先清理环境变量：`Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue`。
- 启动前如已有多个旧开发实例，可以只结束命令行包含 `D:\Code\pomodoro-timer` 的 `node.exe` / `electron.exe`。

## 测试现状

当前测试框架是 `vitest`。

已有测试覆盖：

- `src/core/timer/timerState.test.ts`
- `src/core/stats/statsAggregator.test.ts`
- `src/main/repositories/sqliteRepositories.test.ts`
- `src/main/services/taskService.test.ts`
- `src/main/services/taskBoardService.test.ts`
- `src/main/services/settingsService.test.ts`
- `src/main/services/timerService.test.ts`
- `src/main/services/statsService.test.ts`
- `src/renderer/src/viewModel.test.ts`
- `src/renderer/src/views/StatsView.test.tsx`
- `src/renderer/src/views/TasksView.test.tsx`

最近一次提交前验证：

- `npm test`：11 个测试文件、56 个测试通过。
- `npm run build`：通过。

## 打包信息

- 打包工具：`electron-builder`
- `appId`：`com.focusflow.timer`
- `productName`：`FocusFlow`
- Windows target：`nsis`、`portable`
- 输出目录：`release/`

## 协作约定

- 优先保持分层清晰，不要把业务规则重新塞回 React 组件。
- 共享类型和 IPC 名称统一维护在 `src/shared`。
- 计时正确性优先于界面表现，涉及计时流程时先看 `src/core/timer` 和 `TimerService`。
- 新增桌面能力时，先走 `src/main/adapters` / `src/main/ports`，避免主进程入口继续膨胀。
- 数据访问尽量走 repository，不要在 service 外直接写 SQL。
- 渲染层应只依赖 preload 暴露的 API，不直接触碰 Electron 主进程对象。
- 当前仓库使用 PowerShell 环境，编辑 Markdown / TS / TSX / JSON 时优先使用安全 UTF-8 写法。
- 不要使用 `git reset --hard` 或 `git checkout --` 回退用户已有改动，除非用户明确要求。

## 接手顺序

新一轮开发或接手时，建议按这个顺序熟悉项目：

1. 看 `package.json`，确认命令和打包方式。
2. 看 `src/shared/contracts.ts` 和 `src/shared/types.ts`，理解前后端边界。
3. 看 `src/main/index.ts` 和 `src/main/services/`，理解主进程编排。
4. 看 `src/renderer/src/views/`，对照界面。
5. 最后跑 `npm test` 和 `npm run build`，确认工作树健康。
