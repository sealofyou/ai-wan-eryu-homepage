// 由 eryuOS 活动与奖项索引整理（去掉生活、出差、观众类）。
export type Kind = "attend" | "compete" | "volunteer" | "share";
export interface Footprint { date: string; title: string; kind: Kind; award?: string | null }

export const allFootprints: Footprint[] = [
  {
    "date": "2026.10",
    "title": "Nova AI Club 第十期「学会安排AI干活」 · 团队",
    "kind": "share",
    "award": null
  },
  {
    "date": "2026.10",
    "title": "WaytoAGI AI切磋大会南京站",
    "kind": "compete",
    "award": null
  },
  {
    "date": "2026.10",
    "title": "Nova AI Club 第九期 WorkBuddy 南京线下 Meetup · 团队",
    "kind": "share",
    "award": null
  },
  {
    "date": "2026.09",
    "title": "Nova AI Club 第八期「AI 实战共学坊」 · 团队",
    "kind": "share",
    "award": null
  },
  {
    "date": "2026.09",
    "title": "YOLO Vision 2026 深圳 · FSHD 展位",
    "kind": "compete",
    "award": null
  },
  {
    "date": "2026.08",
    "title": "WaytoAGI 活动志愿者",
    "kind": "volunteer",
    "award": null
  },
  {
    "date": "2026.08",
    "title": "Nova AI Club 第六期「Agent 剪视频」",
    "kind": "share",
    "award": null
  },
  {
    "date": "2026.08",
    "title": "Nova AI Club 第五期 · 现场帮装飞书 CLI",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2026.07",
    "title": "AdventureX",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2026.07",
    "title": "Nova AI Club 第四期「WorkBuddy 实战局」",
    "kind": "share",
    "award": null
  },
  {
    "date": "2026.07",
    "title": "飞书 AI 绝活大会",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2026.07",
    "title": "Nova AI Club 第三期「不用 Skill，AI 差在哪？」",
    "kind": "share",
    "award": null
  },
  {
    "date": "2026.06",
    "title": "WaytoAGI AI 切磋大会（协助）",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2026.06",
    "title": "Nova AI Club 第二期「一个人 + Codex = 一支技术团队」",
    "kind": "share",
    "award": null
  },
  {
    "date": "2026.05",
    "title": "WaytoAGI「做自己的 AI 架构师」",
    "kind": "share",
    "award": null
  },
  {
    "date": "2026.05",
    "title": "抖音 AI 创变者计划合肥站黑客松",
    "kind": "compete",
    "award": null
  },
  {
    "date": "2026.05",
    "title": "南客松志愿者",
    "kind": "volunteer",
    "award": null
  },
  {
    "date": "2026.04",
    "title": "杭州 2050 大会 · FSHD 面部早筛分享",
    "kind": "share",
    "award": null
  },
  {
    "date": "2026.03",
    "title": "WaytoAGI AI 切磋大会志愿者",
    "kind": "volunteer",
    "award": null
  },
  {
    "date": "2026.03",
    "title": "高校黑客松 入选决赛",
    "kind": "compete",
    "award": null
  },
  {
    "date": "2026.01",
    "title": "AI 切磋大会志愿者",
    "kind": "volunteer",
    "award": null
  },
  {
    "date": "2026.01",
    "title": "环球黑客松",
    "kind": "compete",
    "award": null
  },
  {
    "date": "2025.12",
    "title": "WaytoAGI 12 月分享会",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2025.12",
    "title": "模法黑客松 S1 金融赛道",
    "kind": "compete",
    "award": "三等奖"
  },
  {
    "date": "2025.12",
    "title": "WaytoAGI AI 训练营第三期：AI 短剧训练营",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2025.11",
    "title": "第一次参加 WaytoAGI 社区活动",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2025.11",
    "title": "魔搭社区开发者中心启用",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2025.11",
    "title": "Rokid AI＋AR 双引擎黑客松",
    "kind": "compete",
    "award": null
  },
  {
    "date": "2025.10",
    "title": "算网杯 AI Agent 黑客松",
    "kind": "compete",
    "award": null
  },
  {
    "date": "2025.09",
    "title": "GOSIM 杭州",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2025.08",
    "title": "AMD AI 速训营 上海黑客松",
    "kind": "compete",
    "award": null
  },
  {
    "date": "2025.08",
    "title": "书生·浦语实战营第五期 论文微调",
    "kind": "compete",
    "award": "二等奖"
  },
  {
    "date": "2025.08",
    "title": "魔搭交流会（杭州阿里巴巴中心）",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2025.07",
    "title": "飞桨交流会",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2025.05",
    "title": "魔搭社区交流会（杭州）",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2025.04",
    "title": "全球机器学习技术大会（上海）",
    "kind": "attend",
    "award": null
  },
  {
    "date": "2025.02",
    "title": "飞桨开发者圈层沙龙",
    "kind": "attend",
    "award": null
  }
];
