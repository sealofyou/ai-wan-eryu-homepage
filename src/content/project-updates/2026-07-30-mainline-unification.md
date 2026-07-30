---
title: "把分叉的代码主线重新合在一起"
summary: "确认真实发布源后，把旧主线纳入同一段历史，避免后续修改落到错误仓库状态。"
date: 2026-07-30T09:25:12+08:00
projectId: "personal-homepage-build-in-public"
phase: "代码治理"
kind: "release"
draft: false
highlights:
  - "以真实运行版本作为文件树基线"
  - "保留旧历史和回退标签，没有强推覆盖"
  - "main 与 master 后续保持同一提交"
evidence:
  - label: "主线统一提交"
    url: "https://github.com/sealofyou/ai-wan-eryu-homepage/commit/0d970d4"
---

一次诊断发现，线上运行代码和原先记录的“唯一代码基线”已经分叉。继续加功能之前，必须先回答一个很朴素的问题：修改到底应该落在哪一条历史上。

处理方式不是删除旧版本，而是保留当前生产文件树、把两段历史合入同一主线，并为合并前状态建立保护点。之后功能分支都从统一主线出发，GitHub 合并和公网发布仍然是两件事。
