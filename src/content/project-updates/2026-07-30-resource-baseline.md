---
title: "先减掉首屏 94.14% 的图片负载"
summary: "在增加模型之前先压缩现有图片，并让 WebGL 降级图只在真正失败时加载。"
date: 2026-07-30T12:13:44+08:00
projectId: "personal-homepage-build-in-public"
phase: "性能基线"
kind: "verification"
draft: false
highlights:
  - "首屏图片从 6,235,756 字节降到 365,512 字节"
  - "正常 WebGL 首屏不再请求 2,141,964 字节的降级构图图"
  - "增加资源预算检查，防止后续模型悄悄放大默认下载"
  - "47 个测试、类型检查、构建和双分辨率截图验证通过"
evidence:
  - label: "资源优化提交"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/commit/424f152"
  - label: "V0.4 验收标签"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/tree/homepage-v0.4-accepted-20260731"
---

图片转模型会自然带来新的资源，因此不能先加模型、最后再猜页面为什么变慢。这里先把人物图和 Q 版摆件改成适合实际显示尺寸的 WebP，并把大尺寸降级图改成失败后才请求。

这一步同时加入自动预算。以后任何模型或脚本让默认入口超过约定体积，构建检查会直接失败，而不是等到发布后才靠体感发现。
