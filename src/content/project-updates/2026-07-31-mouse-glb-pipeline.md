---
title: "用一只鼠标跑通 GLB 替换管线"
summary: "先让一个小物件支持程序化模型与 GLB 候选并存，验证加载、回退、交互和释放。"
date: 2026-07-31T02:38:20+08:00
projectId: "personal-homepage-build-in-public"
phase: "模型实验"
kind: "implementation"
draft: false
highlights:
  - "默认首页继续使用已经验收的程序化鼠标"
  - "只有显式试验参数才下载 435,088 字节的 GLB"
  - "模型失败会自动回退，拖拽仍使用独立低复杂度命中代理"
  - "58 个测试通过，默认页面的模型预加载为零"
evidence:
  - label: "GLB 管线提交"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/commit/69127c5"
  - label: "V0.5 模型管线标签"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/tree/homepage-v0.5-model-pipeline-20260731"
---

第一次模型实验没有直接替换整套桌面，而是选择体积小、交互边界清楚的鼠标。GLB 只替换视觉层，拖动容器、点击代理和主屏光标同步继续沿用稳定逻辑。

加载器采用按需动态导入，并处理并发缓存、失败重试、取消和幂等释放。这个候选是否成为默认视觉仍要单独验收，但以后新增模型已经不需要重新发明加载和回退流程。
