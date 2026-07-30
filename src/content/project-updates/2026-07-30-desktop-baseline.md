---
title: "先把满意的桌面固定下来"
summary: "在继续拆代码之前，先给已经认可的桌面构图建立不可丢失的 Git 基线。"
date: 2026-07-30T00:43:43+08:00
projectId: "personal-homepage-build-in-public"
phase: "视觉基线"
kind: "decision"
draft: false
highlights:
  - "保留已经确认的桌面构图、相机、材质、文案和交互"
  - "建立 homepage-desktop-baseline-20260729 标签"
  - "后续重构先证明零视觉变化，再讨论新的物件和内容"
evidence:
  - label: "受保护桌面标签"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/tree/homepage-desktop-baseline-20260729"
  - label: "基线保护提交"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/commit/18eae87"
---

这一步没有追求“看起来更高级”，而是先解决可逆性。桌面已经经过多轮构图修改，如果直接在同一份代码上继续拆分，一旦画面发生变化，很难判断是有意优化还是重构回归。

因此先保存受保护标签，再把结构调整放到独立分支。后续每一轮都能回到这个版本比较，而不是靠聊天记录回忆“原来大概是什么样”。
