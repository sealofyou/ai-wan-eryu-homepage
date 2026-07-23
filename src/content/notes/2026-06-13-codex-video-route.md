---
title: "开始梳理 Codex 自动做视频的路线"
description: "把 HyperFrames、Remotion、前端动效和 FFmpeg 的分工拆开，再决定第一版怎么做。"
date: 2026-06-13
type: "project"
draft: true
---

“自动做视频”不是一个单独能力。代码生成动画、真实素材剪辑和前端动效表现，依赖的工具并不一样。

当前更适合先验证 Codex + HyperFrames 的可编程视频路线，再用 FFmpeg 处理素材、音频、字幕和导出。Remotion 保留为后续 React 组件复用与批量渲染方案。
