# 用户指令记忆

## 条目

### 质量门禁
- Date: 2026-06-17
- Context: 每次改完代码后强制执行
- Category: 构建编译
- Instructions:
  - 门禁顺序：`npm run lint` → `npx vitest run` → `npm run build`
  - 三门全过才允许 commit
  - build 命令会自动检查 TypeScript 类型

### 禁止 Mock
- Date: 2026-06-17
- Context: 用户明确禁止 mock 相关改动
- Instructions:
  - 不修改 `scripts/mock-hiclaw.mjs`
  - 降级逻辑放 dashboard 端，不是 mock
  - 不提交 mock-hiclaw 相关改动

### Sandbox 环境 (当前会话)
- Date: 2026-06-17
- Context: Agent 在执行嵌入式 hiclaw controller 启动时发现
- Category: 环境配置
- Instructions:
  - Node 20，无 bun/docker/sudo
  - apt 可用（需 `DEBIAN_FRONTEND=noninteractive`）
  - dockerd 已手动启动（vfs storage driver，`--iptables=false --bridge=none`）
  - hiclaw controller 监听 `*:8090`，二进制在 `/opt/hiclaw/bin/hiclaw-controller`
  - admin SA JWT 在 `/tmp/hiclaw-jwt.txt`（1 年期，621 字节）
  - kubeconfig 在 `/tmp/hiclaw.kubeconfig`

### 预览部署
- Date: 2026-06-17
- Context: Agent 在执行 deploy-website 时记录
- Category: 运维部署
- Instructions:
  - dev server 命令：`npx next dev -H 0.0.0.0 -p 3000`
  - 后台终端 ID：`term_1781679812396_10`
  - 预览 URL 格式：`https://{port}-{hash}.monkeycode-ai.online`
  - 当前 URL：`https://3000-b5574a234d4c1c4e.monkeycode-ai.online`

### Git 分支
- Date: 2026-06-17
- Context: 当前开发分支
- Category: 工作流协作
- Instructions:
  - 当前分支：`260617-feat-agent-chat-modernization`
  - 基础分支：`origin/main`
  - PR：#1（https://github.com/higress-group/TaDashboard/pull/1）
  - 勿动 `hiclaw` / `agentscope-ai/HiClaw` 仓库
