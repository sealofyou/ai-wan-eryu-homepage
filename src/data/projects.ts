export const projects = [
  {
    index: "01",
    title: "Feishu Codex Gateway",
    status: "持续维护",
    category: "Agent 工作流",
    description: "把飞书消息路由到本地 Codex / ACP，再把执行结果写回协作入口。",
    details: ["任务路由与 Agent 链路", "真实消息、身份标识和密钥不公开"],
  },
  {
    index: "02",
    title: "Project Harness Bootstrap",
    status: "可复用",
    category: "协作方法",
    description: "让 Agent 接手项目时能找到事实、运行方式、验收标准和迭代记录。",
    details: ["项目规约与接手入口", "减少重复解释，保留可验证上下文"],
  },
  {
    index: "03",
    title: "FSHD 早筛辅助探索",
    status: "研究中",
    category: "研究项目",
    description: "围绕关键点时序、动作质量门控和专用小模型做动态视觉早筛探索。",
    details: ["产品拆解、CV 路线和模型实验", "只表达辅助筛查研究，不构成诊断"],
  },
] as const;
