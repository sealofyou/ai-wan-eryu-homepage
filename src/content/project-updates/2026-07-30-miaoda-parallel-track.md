---
title: "把秒哒参赛版拆成独立实验"
summary: "同一套桌面想法保留两条实现路线：Astro 主站继续维护，秒哒用原生 2.5D 验证参赛表达。"
date: 2026-07-30T21:21:03+08:00
projectId: "personal-homepage-build-in-public"
phase: "黑客松准备"
kind: "decision"
draft: false
highlights:
  - "秒哒参赛版不导入现有 Astro 源码或 Git 历史"
  - "首轮只验证构图、主屏可读性、物件关系和关键互动"
  - "为生成提示词、参考资产、验收门和止损规则分别建立文档"
evidence:
  - label: "秒哒参赛版说明"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/tree/main/docs/miaoda-contest"
  - label: "参赛方案提交"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/commit/3c08920"
---

秒哒路线的目的不是复制当前站点，而是验证：不用完整 Three.js 工程时，卡通化真实桌面是否仍然能成为一个有趣、可读的个人主页入口。

这条路线和主站共享构图判断与个人视觉资产，但实现和验收独立。这样既不会把已有代码伪装成平台原生作品，也不会为了参赛尝试破坏当前已经可运行的主页。
