---
title: "让作品集先展示项目，而不是展示一张海报"
summary: "移除遮住项目的整屏暗色人像，把真实项目截图、状态、结果和档案入口放回首屏。"
date: 2026-07-31T10:30:00+08:00
projectId: "personal-homepage-build-in-public"
phase: "作品集重做"
kind: "implementation"
draft: false
highlights:
  - "修复宽屏下文案被左右内边距挤成一字一行的问题"
  - "作品集改为读取公开项目 collection，不再维护一套静态项目名单"
  - "首屏使用 56,326 字节的真实桌面截图，并保持 16:9 原始比例"
  - "1440、1920、2048 和 1024 横屏均无横向溢出，视觉评审为 94/100"
evidence:
  - label: "V0.10 设计说明"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/blob/main/docs/superpowers/specs/2026-07-31-portfolio-redesign-design.md"
  - label: "V0.10 实施计划"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/blob/main/docs/superpowers/plans/2026-07-31-v0.10-portfolio-redesign.md"
---

原来的作品集首先展示一张暗色人像海报，项目列表被推到首屏之外。更具体的问题出现在宽屏：文案容器有固定最大宽度，同时左右内边距会随视口增加，最终正文可用宽度接近零，标题和说明都变成一字一行。

这一轮没有继续给旧海报补装饰，而是重新确定作品集的职责。首页的 3D 桌面负责让人愿意探索，作品集负责把真实项目说清楚。因此页面改成短介绍、重点项目和项目索引三段，打开后可以直接看到项目截图、状态、阶段、结果和详情入口。

项目数据也不再来自单独的静态数组。作品集现在读取与“最近在做”和项目档案相同的公开项目 collection，草稿不会出现，推荐项目优先，其余按更新时间排列。以后增加一个公开项目，只需要补项目内容与档案，不需要再改作品集页面。

重点项目封面来自当前真实 3D 首页，压缩后为 56,326 字节。图片的自然尺寸与渲染比例一致，没有拉伸。作品集在常见横屏下完成截图和溢出检查，详情入口可以进入现有 Build in Public 档案；首页则继续使用原来的桌面实现。
