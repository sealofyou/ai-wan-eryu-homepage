---
title: "让“最近在做”开始承载真实项目"
summary: "把稳定项目概览与逐条开发更新接入站内页面，3D 主屏只负责摘要和入口。"
date: 2026-07-31T03:03:22+08:00
projectId: "personal-homepage-build-in-public"
phase: "内容接入"
kind: "implementation"
draft: false
highlights:
  - "新增项目与项目更新两个独立内容集合"
  - "首批接入 7 条可追溯记录和公开证据链接"
  - "最近在做可以从列表进入主屏预览，再打开站内项目页"
  - "64 个测试通过，两个默认桌面视口与 V0.5 保持零像素差"
evidence:
  - label: "Build in Public 设计"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/blob/main/docs/superpowers/specs/2026-07-31-build-in-public-design.md"
  - label: "项目内容目录"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/tree/main/src/content/project-updates"
---

这一步没有把每天的聊天或终端输出搬到网页上，而是把内容拆成稳定概览和独立更新。项目概览回答“为什么做、现在在哪”，每条更新只记录一次判断或变化。

桌面副屏仍然只有三个入口。访客点开“最近在做”后，先在主屏看简短预览，再决定是否进入完整项目页。这样 3D 场景保持简洁，真实过程也不需要依赖飞书接口才能阅读。
