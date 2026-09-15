# 安全策略

## 支持范围

本项目是个人开发的桌面应用，安全修复只针对最新 `main` 分支与 [Releases](https://github.com/gis2all/focus-flow/releases) 中的最新版本；更早的版本不再单独维护。

## 报告漏洞

请勿在 Issue、PR 或公开讨论中透露漏洞细节。

推荐通过 GitHub 私有漏洞报告（Private vulnerability reporting）提交：

1. 打开仓库 **Security** 页签；
2. 点击 **Report a vulnerability**；
3. 按提示填写受影响版本、复现步骤和影响评估。

## 响应承诺

- 7 天内确认收到报告；
- 确认有效的问题在 30 天内给出修复或缓解方案；
- 修复合入后，在发布说明中说明。

## 主要风险面

- 分发渠道：安装包与便携版通过 GitHub Releases 发布，请确认下载来源为本仓库；`win-unpacked/` 仅用于开发者烟测，不作为正式下载项。
- 渲染层：Renderer 运行在 sandbox 中，桌面能力只经 `preload/` 的 `contextBridge`（`window.focusFlow`）暴露；IPC 入参在主进程边界做运行时校验。
- 本地 Web 模式：`server/` 默认只监听 `127.0.0.1` 且无鉴权，对外暴露前必须自行加认证与 HTTPS。
- 本地数据：默认保存在本机（`%APPDATA%` 下的 `focusflow.sqlite`），项目不依赖账号或云同步，也没有应用内自动更新通道。
