# CLAUDE.md

## 项目概览

- 项目名：`FocusFlow`
- 目标：本地优先的 Windows 桌面番茄钟客户端
- 当前技术路线：`Electron + Vite + React + TypeScript + SQLite(sql.js)`
- 包管理器：当前仓库使用 `npm` 锁文件，历史规划里提过 `pnpm`，但以仓库现状为准
- Git：
  - 当前分支：`main`
  - 已配置远端：`git@github.com:gis2all/focus-flow.git`
  - 当前尚未首次提交

## 当前产品范围

V1 目标围绕单机桌面效率工具，不做账号、云同步、团队协作、插件、移动端、复杂项目分类。

当前代码已经覆盖的主要能力：

- 番茄钟主流程
  - 专注 / 短休 / 长休阶段
  - 开始、暂停、恢复、跳过、重置
  - 自动切换与手动切换
  - 基于绝对时间计算剩余时长，避免前端 tick 漂移
- 待办任务
  - 创建
  - 行内编辑
  - 完成 / 恢复
  - 删除
  - 进行中任务拖拽排序
  - 每任务番茄数与专注时长统计
- 统计
  - 今日汇总
  - 时间分布
  - 任务排行
  - 已删除任务的兜底名称展示
- 设置
  - 专注 / 短休 / 长休时长
  - 自动开始下一专注 / 下一休息
  - 通知 / 声音开关
  - 开机自启
  - 启动到托盘
  - 关闭到托盘
  - 主题偏好
- 桌面能力
  - 系统托盘
  - 关闭窗口后继续驻留
  - 可隐藏启动
  - Windows 通知
  - 提示音
  - 运行中退出确认

## 架构原则

项目按低耦合分层组织，核心方向是 `core -> services -> adapters -> UI`。

### 1. `src/core`

纯业务逻辑层，不依赖 Electron、React、数据库实现。

- `timer/`
  - 番茄钟状态机
  - 阶段切换
  - 恢复逻辑
- `stats/`
  - 统计聚合逻辑

这一层应保持可单测、可复用、可脱离桌面环境运行。

### 2. `src/main`

Electron 主进程层，负责应用编排和桌面能力。

- `services/`
  - `TimerService`
  - `TaskService`
  - `TaskBoardService`
  - `StatsService`
  - `SettingsService`
- `repositories/`
  - SQLite Repository 实现
- `adapters/`
  - 桌面能力与 SQLite 适配
- `ports/`
  - 仓储接口与桌面接口定义
- `ipc/`
  - IPC 注册

主进程承担计时兜底和持久化协调，不把核心计时放到 React 页面里。

### 3. `src/preload`

只通过 `contextBridge` 暴露有限 API，避免渲染层直接接触 Electron 或 Node 能力。

### 4. `src/renderer`

React 渲染层，只负责界面、交互、展示状态。

- `components/`
  - 应用外壳、标题栏、图标组件
- `views/`
  - `TimerView`
  - `TasksView`
  - `StatsView`
  - `SettingsView`
- `styles/`
  - 设计 token 与全局样式

### 5. `src/shared`

共享合同层，集中放前后端共用类型、默认值、IPC 合同，避免字符串散落。

## 当前目录地图

```text
src/
  core/
    timer/
    stats/
  main/
    adapters/
    ipc/
    ports/
    repositories/
    services/
  preload/
  renderer/
    src/
      components/
      styles/
      views/
  shared/
```

关键文件：

- `src/main/index.ts`
  - Electron 应用入口
  - 窗口创建、托盘、关闭行为、通知、声音、tick 广播
- `src/shared/contracts.ts`
  - IPC 合同定义
- `src/shared/defaults.ts`
  - 默认配置
- `src/main/adapters/sqlite/schema.ts`
  - SQLite schema
- `src/renderer/src/App.tsx`
  - 渲染层应用入口

## 数据模型

SQLite schema 当前包含：

- `tasks`
  - 任务标题
  - 完成状态
  - 创建/完成时间
  - `sort_order`
- `timer_sessions`
  - 每次专注或休息记录
  - 任务绑定
  - 开始/结束时间
  - 阶段类型
  - 实际时长
  - 是否完成
- `settings`
  - 各类用户设置
- `timer_runtime`
  - 当前运行中计时器的持久化快照
- `app_events`
  - 关键事件日志，用于恢复与排查

## 默认配置

当前默认值来自 `src/shared/defaults.ts`：

- 专注：`25` 分钟
- 短休：`5` 分钟
- 长休：`15` 分钟
- 长休间隔：`4`
- 通知：开启
- 声音：开启
- `closeToTray`：开启
- 主题：默认跟随系统

## IPC 能力概览

当前共享合同覆盖：

- `timer`
  - `getSnapshot`
  - `start`
  - `pause`
  - `resume`
  - `skip`
  - `reset`
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
  - 主题
  - 窗口控制
  - 退出

## 本地开发命令

```bash
npm run dev
npm run build
npm run preview
npm test
npm run package
```

说明：

- `npm run dev`
  - 启动 Electron + Vite 开发环境
- `npm run build`
  - TypeScript 检查并构建 Electron/Vite 输出
- `npm test`
  - 运行 Vitest
- `npm run package`
  - 生成 Windows 安装包与便携版，输出到 `release/`

## 测试现状

仓库中已经有以下测试覆盖：

- `src/core/timer/timerState.test.ts`
- `src/core/stats/statsAggregator.test.ts`
- `src/main/repositories/sqliteRepositories.test.ts`
- `src/main/services/taskService.test.ts`
- `src/main/services/taskBoardService.test.ts`
- `src/main/services/settingsService.test.ts`
- `src/main/services/timerService.test.ts`
- `src/renderer/src/viewModel.test.ts`

测试框架为 `vitest`。

## 打包信息

- 打包工具：`electron-builder`
- `appId`：`com.focusflow.timer`
- `productName`：`FocusFlow`
- Windows 目标：
  - `nsis`
  - `portable`
- 输出目录：`release`

## 协作约定

后续修改建议遵守以下规则：

- 优先保持分层清晰，不要把业务规则重新塞回 React 组件
- 共享类型和 IPC 名称统一维护在 `src/shared`
- 计时正确性优先于界面表现，涉及计时流程时先看 `src/core/timer`
- 新增桌面能力时，先放到 `src/main/adapters` / `src/main/ports`，避免主进程入口持续膨胀
- 数据访问尽量走 repository，不要在 service 外直接写 SQL
- 渲染层应只依赖 preload 暴露的 API，不直接触碰 Electron 主进程对象
- 当前仓库使用 PowerShell 环境，编辑 Markdown / TS / JSON 时优先使用安全 UTF-8 写法

## 当前状态备注

- 仓库已初始化 Git，但仍是未提交状态
- `.gitignore` 已忽略以下主要产物：
  - `.learnings/`
  - `node_modules/`
  - `out/`
  - `release/`
  - `dist/`
  - `coverage/`
  - `*.log`
  - `*.sqlite*`
- 当前主窗口与 UI 风格仍在继续迭代中，后续如果继续做 1:1 视觉还原，建议把“视觉稿约束”和“功能实现”继续分开推进

## 建议的接手顺序

新一轮开发或接手时，优先按这个顺序熟悉项目：

1. 先看 `package.json` 了解命令和打包方式
2. 再看 `src/shared/contracts.ts` 和 `src/shared/types.ts` 理解边界
3. 再看 `src/main/index.ts` 和各 `services/`
4. 最后看 `src/renderer/src/views/` 对照界面

