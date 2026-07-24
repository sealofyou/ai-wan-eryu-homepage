# Eryu 折角 E 品牌标记 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可复用的折角 E Logo 资产，并用它替换 `eryu.fun` 的站点图标。

**Architecture:** 以透明 SVG 作为唯一形状源，浏览器图标版只额外增加暖白圆角背景。通过 Sharp 从 SVG 机械导出 PNG，`eryuOS` 保存跨项目主资产，个人主页保存部署所需副本。

**Tech Stack:** SVG、Sharp、Astro、Vitest、Caddy 静态发布。

---

### Task 1: 建立标准 Logo 资产

**Files:**
- Create: `public/brand/eryu-e-mark.svg`
- Create: `public/brand/eryu-e-icon.svg`
- Create: `public/brand/*.png`

- [ ] 用固定 viewBox 和品牌色实现透明 Logo 与图标版 SVG。
- [ ] 用 Sharp 导出 512、180 和 32px PNG。
- [ ] 检查尺寸、透明通道、文件大小和视觉轮廓。

### Task 2: 同步到 eryuOS

**Files:**
- Create: `05_表达与品牌/assets/ai-wan-eryu/brand-mark-v1/*`
- Modify: `05_表达与品牌/README.md`

- [ ] 复制同源 SVG 和 PNG 到独立品牌资产目录。
- [ ] 新增 README，说明主资产、颜色、透明版与图标版用途。
- [ ] 在表达与品牌模块 README 登记入口。

### Task 3: 接入个人主页

**Files:**
- Modify: `src/layouts/SiteLayout.astro`
- Modify: `public/favicon.svg`
- Test: `tests/desktop-page.test.ts`

- [ ] 先增加会检查 SVG favicon、PNG fallback 和 Apple Touch Icon 的测试断言。
- [ ] 将页面图标声明切换为新品牌资产。
- [ ] 运行 `npm test`、`npm run check` 和 `npm run build`。

### Task 4: 发布与线上验证

**Files:**
- Deploy: `deploy/publish-vps2.ps1`

- [ ] 分别提交并推送个人主页与 `eryuOS` 变更。
- [ ] 执行原子发布脚本，保留上一版回滚点。
- [ ] 验证 HTTPS 首页、favicon SVG/PNG、Apple Touch Icon 均返回 200。
- [ ] 截图确认桌面构图未改变，控制台无错误。
