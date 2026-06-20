# TaDashboard

> HiClaw 的管理面板（Management Dashboard）

TaDashboard 是一个基于 **Next.js** 构建的 Web 管理界面，用于可视化管理 [HiClaw](https://github.com/higress-group/hiclaw) 集群中的 Worker、Team、Human、Manager、Gateway Consumer 等资源，同时集成 Matrix 聊天能力。

---

## 技术栈

- **框架**：Next.js 16 + React 19 + TypeScript
- **样式**：Tailwind CSS v4 + shadcn/ui
- **状态管理**：Zustand + TanStack Query (React Query)
- **数据库**：SQLite + Prisma
- **运行时**：Bun / Node.js
- **部署**：Docker Compose / k3s，Next.js standalone 输出

---

## 功能模块

| 模块 | 说明 |
|------|------|
| **Overview** | 全局概览：活跃 Worker、Team、Matrix 房间数、资源状态 |
| **Workers** | Worker 全生命周期管理：查看、唤醒、休眠、确保就绪、删除 |
| **Teams** | Team 管理：成员、关联 Worker、Human、详情弹窗 |
| **Humans** | Human 资源 CRUD：卡片/表格视图、权限级别、房间关联 |
| **Managers** | Manager 管理：模型配置、欢迎消息、协调团队/Worker |
| **K8s** | Kubernetes CRD 资源卡片展示、YAML/JSON 预览 |
| **Infrastructure** | 基础设施状态：Controller、Matrix、各组件健康度 |
| **Chat** | Matrix 聊天集成：房间列表、成员、消息收发 |
| **Security** | 权限矩阵、访问控制、安全策略展示 |
| **Skills** | Skill/MCP 资源管理 |
| **Architecture** | 架构图与组件关系说明 |
| **Runtime** | 运行时状态与日志 |
| **Quickstart** | 快速上手指引 |

---

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
# 克隆并进入项目
git clone -b dream https://github.com/higress-group/TaDashboard.git
cd TaDashboard

# 复制环境变量并编辑
cp .env.example .env

# 一键启动
docker compose up -d
```

访问 `http://localhost:3000`。

### 方式二：本地开发

```bash
# 前置要求: Bun 1.3+ 或 Node.js 20+
make install        # 安装依赖
cp .env.example .env.local
make db-push        # 初始化数据库
make dev            # 启动开发服务器
```

### 方式三：生产部署（Caddy + 自动 TLS）

```bash
CADDY_DOMAIN=dash.example.com docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 方式四：k3s 集群部署

```bash
make deploy-k3s     # 构建镜像并部署到 k3s
```

---

## 配置环境变量

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | Prisma SQLite 数据库文件 | `file:./db/custom.db` |
| `HICLAW_CONTROLLER_URL` | 服务端访问 HiClaw Controller 的地址 | `http://hiclaw-controller.hiclaw-system:8090` |
| `NEXT_PUBLIC_HICLAW_CONTROLLER_URL` | 浏览器直接访问 Controller 的可选地址 | 空 |
| `HICLAW_AUTH_TOKEN` / `HICLAW_AUTH_TOKEN_FILE` | 访问 Controller 的 Bearer Token 或投影 Token 文件 | 空 |
| `NEXT_PUBLIC_MATRIX_API_URL` | 浏览器访问 Matrix Homeserver 的基础 URL | `http://localhost:6167` |
| `MATRIX_ALLOWED_HOSTS` | 服务端代理允许的额外 Matrix hosts，逗号分隔 | 空 |
| `NEXT_PUBLIC_MATRIX_TOKEN_PERSIST` | Matrix token 持久化策略：`session` / `local` / `none` | `session` |

> 完整变量参见 `.env.example`。

---

## 常用命令（Makefile）

| 命令 | 说明 |
|------|------|
| `make install` | 安装依赖 |
| `make dev` | 启动开发服务器 |
| `make build` | 构建生产产物 |
| `make start` | 启动生产服务器 |
| `make test` | 运行测试 |
| `make lint` | ESLint 检查 |
| `make docker` | 构建 Docker 镜像 |
| `make docker-up` | Docker Compose 启动 |
| `make docker-down` | Docker Compose 停止 |
| `make deploy-k3s` | 构建并部署到 k3s |
| `make clean` | 清理构建产物 |

---

## 核心设计

### 代理层

- 前端不直接访问 HiClaw Controller 或 Matrix Homeserver，所有请求通过 Next.js API Route 代理：
  - `/api/hiclaw/*` → HiClaw Controller
  - `/api/matrix/*` → Matrix Homeserver
- `proxy-helper.ts` 负责请求转发、认证头注入、超时与错误处理。

### 认证

- Dashboard 在 k3s 中通过 projected ServiceAccount Token 访问 Controller。
- Token 每次请求时重新读取，支持短时效 Token 自动轮转。
- Matrix 访问 Token 通过前端 `?accessToken=` 或 `Authorization` 头部传入。

### 数据持久化

- Dashboard 本地 SQLite 仅用于前端状态（通知、会话等）。
- Worker/Team/Human/Manager 等业务状态由 HiClaw Controller 管理。
- Docker Compose 通过 named volume 持久化，k3s 通过 PVC 持久化。

---

## 项目结构

```
TaDashboard/
├── src/
│   ├── app/
│   │   ├── api/hiclaw/        # HiClaw Controller 代理 API
│   │   ├── api/matrix/        # Matrix Homeserver 代理 API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── dashboard/         # 面板业务组件
│   │   │   ├── sections/      # 各功能区域组件
│   │   │   └── hi-claw-dashboard.tsx
│   │   └── ui/                # shadcn/ui 基础组件
│   ├── hooks/                 # TanStack Query + 业务 Hooks
│   └── lib/                   # 工具函数、API 客户端、Store
├── prisma/
│   └── schema.prisma          # SQLite 数据模型
├── deploy/k3s/                # k3s Kubernetes 部署清单
├── scripts/                   # 部署辅助脚本
├── Dockerfile                 # 多阶段 Docker 构建
├── docker-compose.yml         # 单机 Docker Compose
├── docker-compose.prod.yml    # 生产级 Caddy + TLS
├── Makefile                   # 统一构建命令
├── Caddyfile                  # Caddy 反向代理配置
└── package.json
```

---

## 安全注意事项

- 已移除全局 `Access-Control-Allow-Origin: *`，CORS 如需配置请在 Ingress/网关层处理。
- 容器以非 root 用户运行，并启用只读根文件系统。
- `.env` 与本地数据库不应提交到 Git。
- 生产环境请使用私有镜像仓库、TLS、NetworkPolicy 和最小权限 ServiceAccount。

---

## 许可证

本项目属于 higress-group，具体许可证请参考仓库根目录授权文件。

---

## 相关仓库

- [TaDashboard](https://github.com/higress-group/TaDashboard)
- [HiClaw](https://github.com/higress-group/hiclaw)（Controller）