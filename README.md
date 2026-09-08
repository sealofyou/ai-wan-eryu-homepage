# AI玩尔玉个人主页

基于 Astro 的静态个人主页。页面和时间笔记详情都会在构建时生成普通 HTML，可部署到 OSS、Caddy、Nginx 或其他静态托管服务。

正式入口：`https://eryu.fun/`。`http://eryu.fun/` 会自动跳转到 HTTPS；部署与回滚说明见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 本地运行

```powershell
npm install
npm run dev
```

默认地址：`http://127.0.0.1:4321/`

当前桌面视觉候选（本地检查，未替换正式站）：

- `/?desktop=refined`：全部精修模型组合。
- `/model-gallery/`：统一检查机箱、台灯、音箱、键鼠、双屏和桌面环境；支持旋转与材质/素模。
- `/`：保留原物件对照。旧的`monitors=study&mouse=study&keyboard=study`参数仍可用。

本工作树当前开发服务为`http://127.0.0.1:4330/`。阶段证据与已知边界见`IMPLEMENTATION_RESULT.md`。未获用户明确确认前，不合并或部署视觉候选。

## 检查与构建

```powershell
npm test
npm run check
npm run build
```

构建产物位于 `dist/`。部署时只需要发布这个目录。

## 页面结构

- `/`：首页。
- `/portfolio/`：作品集。
- `/notes/`：时间笔记，支持分享、活动、项目、随记筛选。

## 增加时间笔记

在 `src/content/notes/` 新建 Markdown 文件：

```markdown
---
title: "记录标题"
description: "列表页显示的一句话摘要。"
date: 2026-07-18
type: "share"
draft: false
location: "可选地点"
images: []
---

记录正文从这里开始。
```

`type` 可填写：

- `share`：分享。
- `activity`：活动。
- `project`：项目。
- `note`：随记。

资料没有整理好时，可以设置 `draft: true`，构建后不会公开。

## 内容原则

- 先少量发布，不为了填满页面补古早内容。
- 不公开内部状态、待确认项、敏感路径或凭据。
- 分享与活动统一进入时间笔记；形成完整观点后再整理成文章。
- 图片放入站点前先确认公开边界和人物授权。

部署方案见 [DEPLOYMENT.md](./DEPLOYMENT.md)。
