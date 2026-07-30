---
title: "先把真实物件的照片与模型入口定下来"
summary: "在继续替换键盘、机箱和台灯之前，先把照片隐私、模型来源、授权、坐标、体积、预览和回退规则做成可执行 Gate。"
date: 2026-07-31T06:35:00+08:00
projectId: "personal-homepage-build-in-public"
phase: "模型接入准备"
kind: "implementation"
draft: false
highlights:
  - "现有游戏鼠标成为第一条完整模型资产记录，仍然只在显式预览参数下加载"
  - "新增模型清单检查，拒绝路径逃逸、未登记 GLB、超预算资产和未经确认的默认切换"
  - "原始实物照片默认不进入公开仓库，先检查屏幕内容、序列号、二维码和镜面倒影"
  - "拿到照片后每轮只替换一个物件，程序化版本永久保留为回退"
evidence:
  - label: "V0.9 实施计划"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/blob/main/docs/superpowers/plans/2026-07-31-v0.9-model-intake-gate.md"
  - label: "真实物件拍摄说明"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/blob/main/docs/modeling/desktop-object-photo-intake.md"
  - label: "模型资产清单"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/blob/main/public/models/desktop/manifest.json"
  - label: "模型资产检查器"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/blob/main/scripts/check-model-assets.mjs"
---

这一轮没有继续猜键盘、机箱或台灯应该长什么样，也没有把新的模型直接塞进默认桌面。真正缺少的是尔玉实际物件的照片，因此先把“照片来了以后怎么做”变成一条不会破坏现有页面的流程。

原始照片默认只作为建模输入，不进入公开仓库。照片先检查屏幕内容、二维码、序列号、快递单、他人面孔和镜面倒影；公开仓库只保留确认后的 GLB、脱敏来源说明和必要参考。

模型目录现在有了机器可检查的清单。每个 GLB 都必须说明来源、生成工具、输入素材权利、授权、坐标、原点、缩放、体积预算、预览参数和默认状态。候选没有明确验收记录时，Gate 不允许把它设成默认。

下一次收到一组真实物件照片后，可以只为该物件建立候选，在独立地址比较默认版和模型版。候选失败、加载失败或最终不采用，都不会影响当前桌面。
