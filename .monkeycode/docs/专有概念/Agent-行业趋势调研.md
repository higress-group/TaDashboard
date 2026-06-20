# Agent 行业趋势调研

> 这是 R4（Agent Industry Trend Alignment）验收条件 1 的产出：在动手改造 dashboard 之前，先把 2025-2026 agent 生态已经收敛的几个方向列清楚，并标注本项目对应的入口。

## 1. Agent 通信与协议

### A2A（Agent-to-Agent）

Google 2025-04 发布，6 月捐给 Linux 基金会，50+ 厂商背书。核心是 Agent Card 能力发现 + JSON-RPC 任务生命周期。

- 规范：https://a2a-protocol.org/
- Linux Foundation 项目页：https://www.linuxfoundation.org/projects/a2a

**对本项目**：HiClaw Controller 已是"Agent 集群"的雏形，但当前 API 不暴露 Agent Card（能力 / 协议版本 / 输入输出 schema）。下一步可以让 Controller 在 `/version` 或新端点返回 Agent Card 列表，dashboard 在 Worker / Manager 卡片上展示"能力徽标"。

### MCP（Model Context Protocol）

Anthropic 2024-11 发布，2025-11 移交 Linux Foundation Agentic AI Foundation。是"Agent 调用工具 / 数据"的标准接口。

- 规范：https://modelcontextprotocol.io/
- 服务器注册：https://github.com/modelcontextprotocol/servers

**对本项目**：Skills section 已经是 HiClaw 的 Skills 抽象。MCP 是 Skills 的生态对齐方向之一；新加 Skills 时优先考虑 MCP-style JSON Schema 描述。

### A2UI（Agent-to-User Interface，Google）

Google 的 A2UI v0.9 已发布，是一种声明式 JSON 协议，用于让 Agent 直接生成结构化 UI（卡片、表单、按钮）。与 CopilotKit 的 AG-UI 协议不是同一物。

- A2UI 主页 / 规范：通过 CopilotKit 生态入口与 Google 文档双向引用
- AG-UI 对照：https://docs.ag-ui.com/

**对本项目**：本次升级选定 A2UI 作为聊天内的结构化 UI 渲染器，落地在 `src/lib/a2ui.ts`。AG-UI（事件流协议）暂不引入——工作量翻倍，且要求 Controller 端配套改造。

### IBM ACP / AGNTCY

IBM ACP 走 REST 风格做 Agent 间通信；AGNTCY 由 Cisco 牵头成立"Internet of Agents"联盟。

- AGNTCY：https://agntcy.org/
- IBM ACP：https://github.com/i-am-bee/acp

**对本项目**：暂不引入。观察中。

## 2. Agent UI 与可观测性

### LangSmith + LangGraph Studio

原生 trace、annotation queue、online evals，对图编排的状态机可直接回放调试。

- LangSmith：https://www.langchain.com/langsmith
- LangGraph：https://langchain-ai.github.io/langgraph/

**对本项目**：Worker 详情卡片加 "Trace" 链接，指向 Controller 日志端点（若 Controller 暴露）。这是一个"低投入、高感知"的现代化信号。

### Browser-Use / Computer-Use

browser-use 95k+ star，封装 Playwright。Claude Computer Use 2026-03/04 推出。

- https://github.com/browser-use/browser-use
- Claude Code 文档：https://code.claude.com/docs/en/overview

**对本项目**：与 HiClaw 当前的"Worker 执行 runtime"模型没有直接耦合，但 Runtime section 可以加一个"现代 Worker 能力图谱"小卡片，标注哪些 Worker 启用 Computer-Use 模式。

## 3. 现代 Agent 抽象与运行时

### 多 Agent 框架三足鼎立

LangGraph（状态机图）、CrewAI（角色剧本）、AutoGen（圆桌对话）。Agno、smolagents 走极简路线。

- LangGraph：https://github.com/langchain-ai/langgraph
- Agno：https://github.com/agno-agi/agno
- smolagents：https://github.com/huggingface/smolagents

**对本项目**：HiClaw 已有 Manager（跨 Team 协调）+ Worker（执行 runtime）+ Team（共享上下文）三件套，正好对应"Manager 状态机 + Worker 执行 + Team 上下文"三种主流抽象。Runtime section 的"运行时概念图"小节可以直接借这三种抽象做对照讲解。

### Skills / Sessions / SubAgents

Anthropic CLI 2026-06 引入 `agents` / `sessions` / `environments` 资源，原生支持多 Agent 持久会话与文件式 Skills。

**对本项目**：HiClaw 已有 Skills 抽象（`Worker.skills[]`、`Manager.coordinatedTeams[]`）。下一步让 Controller 在 Worker 详情里暴露 `sessions` 列表，dashboard 在 Worker 卡片上展示最近活跃的 session。

## 4. 现代 Dashboard 视觉范式

### Mission Control / Cluster View

网格化平铺所有运行中 Agent、实时状态徽标、一键干预（暂停 / 恢复 / 回滚）。Cursor 3.0、Modal Lab、Replicate 均采用。

- Modal：https://modal.com/
- Replicate：https://replicate.com/explore

**对本项目**：Workers + Managers section 改为 Mission Control 网格（`src/components/dashboard/modern-chrome/` 提供 `modern-grid.tsx`）。其它 11 个 section 统一走同一套 chrome（`modern-card` / `modern-section-header`）。

### 节点拓扑图（xyflow / React Flow）

xyflow v12 已成为 Agent 工作流可视化和 LangGraph 调试器的事实标准。Dify、n8n、Flowise 全部采用。

- xyflow：https://reactflow.dev/

**对本项目**：Infrastructure section 把当前垂直列表换成节点 + 边的关系图（Controller → Higress → Matrix → MinIO → k8s API）。

### 暗色优先 + 玻璃态 + 渐变描边 + Bento Grid

Linear、Vercel、Replicate 引领：暗色基底 + 半透明卡片 + 极光渐变描边 + 大圆角 Bento 网格。2026 dashboard 视觉已成定式。

- Vercel Observability：https://vercel.com/docs/observability

**对本项目**：`modern-card` 走 `rounded-2xl + backdrop-blur-md + 渐变 hairline border`。`modern-grid` 提供 Bento 布局工具。

### AI 协同 IDE

Cline（开源 VSCode 插件）、Cursor（商业 IDE）、Claude Code（终端 Agent）代表三种形态。

- Cline：https://github.com/cline/cline
- Cursor：https://cursor.com/
- Claude Code：https://code.claude.com/

**对本项目**：Security / Quickstart section 可以加一个"现代 Agent 工作流推荐"小卡片，列三条主流路径，不替用户选。

## 5. 现状与改造建议

| 项 | 现状 | 下一步 | 实施 |
|---|---|---|---|
| Agent Card 暴露 | 缺失 | Controller 增 `/agents/{type}/{name}/card` 端点 | 留待 Controller 侧 |
| MCP Skills 描述 | 部分 | Skills section 加 MCP-style schema 展示 | 现有 skills-section 已聚合，本期视为"已存在" |
| A2UI 渲染 | 缺失 | 本次升级引入 `src/lib/a2ui.ts` | ✅ `src/lib/a2ui.ts`（8 个 component + allow-list） |
| Trace 链接 | 缺失 | Worker 卡片加 "Trace" 链接（若 Controller 暴露） | ✅ WorkerTraceDialog + `/api/hiclaw/workers/[name]/events` 代理；404 时显示"未暴露"占位 |
| Mission Control 视觉 | 仅 Workers section 部分具备 | 全部 13 个 section 走现代 chrome | ✅ dashboard 层 ModernSectionHeader 包裹 + section body 保留 |
| 拓扑图 | 垂直列表 | Infrastructure 改 xyflow 节点图 | 🔄 现有 reactflow 渲染保留，未替换；本阶段以 chrome 升级为主 |
| Activity Feed | 缺失 | 顶栏 Activity Feed 20 条流 | ✅ `/api/activity` + `<ActivityFeed />`（仅 audit 来源，预留 matrix/infrastructure 扩展） |

## 5.1 改造完成度（截至阶段 5-8）

- **已迁 modern chrome**（13/13）：overview / workers / teams / managers / humans / chat / infrastructure / k8s / skills / architecture / security / runtime / quickstart
- **已迁 modern chat**：A2UI 渲染 / Markdown 渲染 / Typing Indicator / Sanitize 白名单
- **未迁 / 留作 Controller 侧**：
  - Agent Card 端点（依赖 HiClaw Controller）
  - Skills MCP-style schema（依赖 Controller 返回结构化 skills 字段）
  - Worker Trace 端点（已建代理 + 404 占位，待 Controller 暴露）
  - Infrastructure 拓扑图：现有 reactflow 视图保留，xyflow 替换留待后续（reactflow 12 已支持，本阶段 chrome 升级不重复引入）

## 6. 暂不引入的方向

- **AG-UI 事件流协议**：需要 Controller 端配套改造，工作量翻倍。R3 已选定 A2UI 作为路径。
- **AGNTCY / IBM ACP**：与本项目体量不匹配。
- **Computer-Use / Browser-Use**：HiClaw 的 Worker runtime 模型与这两者解耦，仅在 Runtime section 作概念对照，不引入运行时集成。

## 7. 时间锚点

- 2024-11：Anthropic MCP 发布
- 2025-04：Google A2A 发布
- 2025-06：A2A 捐给 Linux 基金会
- 2025-11：MCP 移交 Linux Foundation Agentic AI Foundation；W3C WebAgent 工作组立项
- 2026-03/04：Claude Computer Use 推出
- 2026-06：CopilotKit AG-UI 发布；Anthropic CLI 引入 agents / sessions / environments
- 2026-06：Google A2UI v0.9 发布

## 引用

[^1]: A2A 规范 — https://a2a-protocol.org/
[^2]: MCP 规范 — https://modelcontextprotocol.io/
[^3]: AG-UI 协议 — https://docs.ag-ui.com/
[^4]: xyflow — https://reactflow.dev/
[^5]: LangSmith — https://www.langchain.com/langsmith
[^6]: Modal — https://modal.com/
[^7]: Replicate — https://replicate.com/explore
[^8]: Vercel Observability — https://vercel.com/docs/observability
[^9]: Cursor — https://cursor.com/
[^10]: Claude Code — https://code.claude.com/