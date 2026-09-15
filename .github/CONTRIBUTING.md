# 贡献指南

欢迎为「FocusFlow」贡献代码、文档和想法。无论是修 bug、补测试、提建议还是改文档，请先阅读本指南与 [README](../README.md)。

## 开发环境

需要 Windows 10/11 x64 与 Node.js 22（含 npm），安装依赖使用 `npm ci`。

| 用途 | 命令 |
| --- | --- |
| 桌面开发态 | `npm run dev` |
| 网页模式 | `npm run web:start` |
| 网页开发态 | `npm run web:dev` |
| 单元测试 | `npm test` |
| 覆盖率 | `npm run test:coverage` |
| 打包 | `npm run package` |

完整命令与平台边界见 [CLAUDE.md](../CLAUDE.md)，用户可见能力见 [README](../README.md)。

## 提交前检查

CI 会执行与下面相同的门禁（Windows / PowerShell 语义，不要用 bash 风格 `&&`），请先在本地跑通：

```powershell
npm ci
npm run test:coverage
npm run build
npm run test:e2e
npm run package
npm run test:package-smoke
```

- 覆盖率门禁只统计纯逻辑模块（`core/`、`shared/`、`main/services/`、`main/repositories/`、`main/adapters/sqlite/`、`server/rpc.ts` 等），阈值 statements / lines 90、functions 85、branches 70；壳层与视图由 E2E 覆盖。
- 修改计时、统计、任务等业务规则时，同步补充或更新对应单元测试。
- 修改交互、窗口、托盘、通知、持久化等壳层行为时，补充或更新 Playwright E2E（`npm run test:e2e`）。
- 运行 `npm run package` 前先退出所有从 `output/release/` 启动的 FocusFlow 实例，否则打包会因目录被占用报 `EBUSY`。
- 不要提交 `output/`、`coverage/`、`node_modules/`、`*.sqlite*`、`docs/`、`.learnings/` 等产物与本地目录。

## 修改边界

- 业务规则放 `core/` 或 `main/services/`，不要塞回 React 组件。
- Renderer 只通过 preload 暴露的 `window.focusFlow` 访问桌面能力，不直接触碰 Electron 主进程对象。
- Web 端复用 `core/` 与 `main/services/`，通过 `server/rpc.ts` 分发请求，并复用主进程的运行时校验。
- IPC channel、shared 类型、数据库 schema、打包产物命名是稳定边界，改动前先确认影响面。
- 主进程边界对入参做运行时校验，不要把 TypeScript 类型当作不可信 renderer 数据的运行时保证。

完整规则见 [CLAUDE.md](../CLAUDE.md)。

## 分支与 PR

1. 从最新 `main` 切出分支，命名如 `codex/fix-xxx`、`feat/xxx`。
2. 完成修改并通过本地检查清单。
3. 推送分支并创建 PR，按 [PR 模板](./PULL_REQUEST_TEMPLATE.md) 填写。
4. 等待 CI 通过和审核；合入 `main` 后由维护者打包并创建 Release。

## 问题与安全

- Bug 和功能建议请用仓库的 Issue 模板提交。
- 安全漏洞不要公开发布，请按 [SECURITY.md](./SECURITY.md) 私下报告。
- 参与 Issue、Pull Request、讨论时请遵守[行为准则](./CODE_OF_CONDUCT.md)。
