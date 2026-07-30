---
title: "把 1412 行场景拆成可以继续扩展的模块"
summary: "把屏幕、物件、渲染核心和交互从 scene.ts 中拆开，同时要求默认画面完全不变。"
date: 2026-07-30T03:27:27+08:00
projectId: "personal-homepage-build-in-public"
phase: "架构重构"
kind: "implementation"
draft: false
highlights:
  - "scene.ts 从 1412 行收敛到 366 行"
  - "屏幕、渲染核心、物件与交互分别进入独立目录"
  - "45 个测试通过，1440×900 与 1920×1080 均为零像素差"
  - "页面卸载后会停止动画并释放 Canvas、材质、纹理与监听器"
evidence:
  - label: "生命周期收尾提交"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/commit/b0710a7"
  - label: "架构设计"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/blob/main/docs/superpowers/specs/2026-07-30-homepage-evolution-design.md"
---

原来的场景能运行，但增加一个物件要同时碰建模、坐标、点击、状态和销毁逻辑。真正的成本不是写几十行 Three.js，而是所有东西都挤在同一个函数里，改动很难单独验证。

这轮重构只改变代码边界，不改变画面。所有物件统一返回可交互目标和可选的更新、释放函数；`scene.ts` 只负责装配。这样后续替换鼠标或键盘时，不需要重新理解整张桌子。
