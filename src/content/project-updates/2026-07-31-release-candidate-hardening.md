---
title: "把本地验收收敛成发布候选 Gate"
summary: "把测试、构建、资源预算、断链、敏感内容和外链安全合成一条可重复执行的发布前检查。"
date: 2026-07-31T04:40:00+08:00
projectId: "personal-homepage-build-in-public"
phase: "发布候选"
kind: "verification"
draft: false
highlights:
  - "15 个测试文件、91 项测试全部通过"
  - "4 个必需入口、站内资源、相对链接和响应式图片统一进入构建产物审计"
  - "双分辨率与 V0.7 保持零像素差，另外 4 个常见横屏尺寸无溢出"
  - "依赖审计为 0，真实发现并修复 1 处不安全的新窗口外链"
evidence:
  - label: "V0.8 发布候选计划"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/blob/main/docs/superpowers/plans/2026-07-31-v0.8-release-candidate.md"
  - label: "发布候选检查器"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/blob/main/scripts/check-release-candidate.mjs"
  - label: "Astro 7.1.6 官方发布"
    url: "https://github.com/withastro/astro/releases/tag/astro%407.1.6"
  - label: "Astro 7.1.0 官方发布"
    url: "https://github.com/withastro/astro/releases/tag/astro%407.1.0"
  - label: "已撤回的 OSV 记录"
    url: "https://osv.dev/vulnerability/MAL-2026-10726"
  - label: "GitHub 安全公告记录"
    url: "https://github.com/advisories/GHSA-hpcx-pg6g-x697"
---

这一步没有再往桌面上增加物件，而是先把“可以发布”变成一组能重复执行的条件。现在一条命令会依次完成单元测试、Astro 诊断、静态构建、资源预算和构建产物审计，并检查必需页面、站内资源、本机路径、常见凭据形态和新窗口外链安全。

检查器先由失败测试驱动，再拿真实构建结果校准。它确实发现了一个静态分享页的新窗口链接缺少安全属性；修复后，又为相对 HTML 与 CSS 资源、无引号属性、Astro 的 `404.html` 输出以及压缩脚本误报补了回归测试。

依赖更新也经过单独审计。核查时，Astro `7.1.0` 的信息存在冲突：官方发布带有已验证签名，一条 OSV 恶意包记录后来被标记为撤回，而 GitHub 安全公告仍保留相关记录。这里采取的是当时的谨慎措施，不对该版本下恶意结论：没有运行它的 CLI，直接改用官方签名发布的 `7.1.6`；Sharp 更新到 `0.35.3`。全量与生产依赖审计均为 0。

默认桌面没有借这次收口顺便改样式。两个基准分辨率与 V0.7 保持零像素差，另外四个常见横屏尺寸也完成了非空渲染、溢出和核心交互检查。公网仍未更新，下一步先做本地验收。
