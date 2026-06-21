# TaDashboard + HiClaw 整合部署指南

本指南描述如何在已部署 [HiClaw Helm Chart](https://artifacthub.io/packages/helm/higress/hiclaw) 的 Kubernetes 集群上，叠加部署 TaDashboard，并暴露到公网/局域网访问。

> 适用场景：HiClaw 核心组件（controller、Higress、Matrix/Tuwunel、MinIO）已通过 Helm 部署完成，只需要再部署 Dashboard UI。

---

## 架构

```
浏览器 ──http://dashboard.hiclaw.local──> Higress gateway (hostNetwork 80/443)
                                            │
                                            ├── /             → hiclaw-dashboard:80
                                            ├── /api/hiclaw/* → hiclaw-dashboard:80 (Next.js API proxy)
                                            ├── /_matrix/*    → hiclaw-tuwunel:6167
                                            └── /             → hiclaw-element-web:8080 (默认域 fallback)
                                              
                       hiclaw-dashboard ──> hiclaw-controller:8090 (K8s SA token auth)
```

---

## 前置条件

- k3s / Kubernetes 集群
- Helm 3
- kubectl
- Docker（构建镜像）
- HiClaw Helm chart 已部署：

```bash
helm repo add higress.io https://higress.io/helm-charts
helm install hiclaw higress.io/hiclaw -n hiclaw-system --create-namespace
```

---

## 部署步骤

### 1. 构建并导入镜像

```bash
cd /root/TaDashboard
scripts/build-and-load-image.sh
```

多节点集群请配置 `DASHBOARD_REGISTRY` 推送到私有仓库。

### 2. 部署 Dashboard

```bash
scripts/deploy-with-hiclaw.sh
```

该脚本：

- 只应用 `deploy/k3s-with-hiclaw/` 下的 dashboard 资源。
- 不复刻 controller、Higress、Matrix、MinIO。
- 等待 `hiclaw-dashboard` Deployment rollout 完成。

### 3. 配置本地 / 公网域名

默认 Ingress host 为 `dashboard.hiclaw.local`。在访问机器上配置 hosts：

```bash
# 把 <NODE_IP> 替换为 k3s 节点实际 IP
<NODE_IP> dashboard.hiclaw.local
```

公网访问时，把域名 A 记录指向节点公网 IP，并将 `deploy/k3s-with-hiclaw/30-ingress.yaml` 中的 host 改为真实域名，然后重新 `kubectl apply -k deploy/k3s-with-hiclaw`。

### 4. 访问

```text
http://dashboard.hiclaw.local
```

Matrix 登录默认使用 `admin` / Helm 安装时 `credentials.adminPassword` 的密码。

---

## 关键配置说明

### Dashboard 连接 Controller

```yaml
HICLAW_CONTROLLER_URL: http://hiclaw-controller.hiclaw-system.svc.cluster.local:8090
```

### Controller 认证

HiClaw controller 启用 K8s SA token 认证，且只接受特定 ServiceAccount name pattern。Dashboard Pod 必须复用 `hiclaw-manager` ServiceAccount：

```yaml
serviceAccountName: hiclaw-manager
```

> 坑：使用自定义 `hiclaw-dashboard` SA 或 `hiclaw-controller` SA 都会报 `unrecognized SA name pattern`。

### Matrix 地址改写

Controller 的 `/infrastructure` API 返回的是集群内部 Matrix 地址：

```text
http://hiclaw-tuwunel.hiclaw-system:6167
```

浏览器无法直接访问该地址。前端代码已做改写：

```tsx
// src/components/dashboard/sections/chat-section.tsx
const publicHomeserverUrl = typeof window !== 'undefined' ? `${window.location.origin}` : '';
const inferredHomeserverUrl =
  infrastructure?.matrix?.homeserver && publicHomeserverUrl
    ? publicHomeserverUrl
    : infrastructure?.matrix?.homeserver || '';
```

登录表单默认填充 `http://dashboard.hiclaw.local`。

### Pod 内解析公网域名

服务端 `/api/matrix/login` 也会用浏览器提交的 homeserver URL 去请求 Matrix。为了让 Pod 内能解析 `dashboard.hiclaw.local`，添加了 `hostAliases`：

```yaml
hostAliases:
  - ip: "10.43.207.53"  # higress-gateway cluster IP
    hostnames:
      - "dashboard.hiclaw.local"
```

> 坑：如果不加 hostAliases，服务端 fetch `http://dashboard.hiclaw.local` 会报 `fetch failed`。

---

## 遇到的坑与避免方法

| 坑 | 现象 | 解决方案 |
|---|---|---|
| 用 `.localhost` 做公网域名 | 浏览器强制 HTTPS，报访问被拒绝 | 改用 `.local` 或真实域名 / nip.io |
| Dashboard Ingress host 被 kustomize 覆盖 | 改完 patch 后 `kubectl apply -k` 又变回 `hiclaw.localhost` | 直接修改 `deploy/k3s-with-hiclaw/30-ingress.yaml` |
| Matrix `/_matrix` 被 dashboard Ingress 覆盖 | `/_matrix/client/versions` 返回 dashboard 404 | patch `matrix-homeserver` Ingress，添加同域名 `/_matrix` 规则 |
| `hiclaw-manager` CrashLoopBackOff | `ModuleNotFoundError: No module named 'copaw_worker'` | `helm upgrade ... --set manager.runtime=openclaw` |
| Prisma 在 initContainer 里每次下载 | initContainer 超时 / ContainerCreating | Dockerfile runtime 阶段预装 `prisma` CLI |
| Matrix homeserver 是内部地址 | 登录报 `Homeserver host not allowed` | 前端改写为 `window.location.origin`，白名单加内部短域名 |

---

## 常用验证命令

```bash
# Dashboard 页面
curl -H 'Host: dashboard.hiclaw.local' http://<NODE_IP>/

# Controller API
curl -H 'Host: dashboard.hiclaw.local' http://<NODE_IP>/api/hiclaw/managers

# Matrix homeserver
curl -H 'Host: dashboard.hiclaw.local' http://<NODE_IP>/_matrix/client/versions

# Matrix 登录
curl -X POST -H 'Host: dashboard.hiclaw.local' -H 'Content-Type: application/json' \
  http://<NODE_IP>/api/matrix/login \
  -d '{"homeserver":"http://dashboard.hiclaw.local","username":"admin","password":"YOUR_PASSWORD"}'
```

---

## 回滚

```bash
kubectl -n hiclaw-system rollout undo deploy/hiclaw-dashboard
```

删除 dashboard：

```bash
kubectl delete -k deploy/k3s-with-hiclaw
```

---

## 故障排查

### Controller 返回 401，`service account UID does not match claim`

**现象**

- Dashboard 页面能打开，但调用 `/api/hiclaw/*` 返回 401 Unauthorized。
- Controller 日志出现：

  ```text
  [AUTH] authentication failed: token not authenticated:
  service account UID (NEW_UID) does not match claim (OLD_UID)
  ```

- `/api/hiclaw/infrastructure` 中的 `kubernetes` 可能显示 `healthy: false`。

**原因**

Dashboard Pod 使用 `hiclaw-manager` ServiceAccount 的 projected token 访问 Controller。
如果 HiClaw Helm release 被卸载/重装、或者 `hiclaw-manager` SA 被删除重建，SA 的 UID 会改变，
但旧 Pod 中的 token 仍然缓存着旧 UID，导致 Controller 的 TokenReview 校验失败。

**解决**

重启 Dashboard Deployment，让 Pod 重新挂载新 SA 的 token：

```bash
kubectl -n hiclaw-system rollout restart deploy/hiclaw-dashboard
kubectl -n hiclaw-system rollout status deploy/hiclaw-dashboard --timeout=180s
```

如果重启后仍然 `ImagePullBackOff`，说明 k3s 本地 containerd 中 dashboard 镜像丢失，需要重新导入：

```bash
cd /root/TaDashboard
docker save hiclaw-dashboard:dev -o /tmp/dashboard-image.tar
k3s ctr images import /tmp/dashboard-image.tar
rm -f /tmp/dashboard-image.tar
kubectl -n hiclaw-system rollout restart deploy/hiclaw-dashboard
```

**避免**

- 不要随意删除 HiClaw 创建的 ServiceAccount（`hiclaw-controller`、`hiclaw-manager`）。
- 如果必须重装 HiClaw，重装后顺手重启一次 Dashboard Pod：

  ```bash
  kubectl -n hiclaw-system rollout restart deploy/hiclaw-dashboard
  ```

### Dashboard Pod `ImagePullBackOff`

**现象**

```text
Failed to pull image "hiclaw-dashboard:dev":
failed to resolve reference "docker.io/library/hiclaw-dashboard:dev": 403 Forbidden
```

**原因**

k3s 节点本地 containerd 没有 `hiclaw-dashboard:dev` 镜像，kubelet 尝试从 docker.io 拉取并失败。

**解决**

重新执行构建脚本：

```bash
cd /root/TaDashboard
scripts/build-and-load-image.sh
```

或手动导入已构建的镜像：

```bash
docker save hiclaw-dashboard:dev -o /tmp/dashboard-image.tar
k3s ctr images import /tmp/dashboard-image.tar
rm -f /tmp/dashboard-image.tar
kubectl -n hiclaw-system rollout restart deploy/hiclaw-dashboard
```

### Higress gateway 长时间 `ContainerCreating`

**现象**

`higress-gateway` 或 `higress-controller` Pod 长时间处于 `ContainerCreating`，外部访问无响应。

**原因**

HiClaw 镜像较大（尤其 higress gateway/controller），在弱网环境下拉取耗时很长。

**解决**

等待镜像拉取完成：

```bash
kubectl -n hiclaw-system get events --sort-by='.lastTimestamp' | tail -20
```

如果节点磁盘/网络资源紧张，可以临时 stop dashboard 构建时不需要的 HiClaw workload 来加速镜像拉取，但生产环境不建议这样做。

### Matrix 登录报 `Homeserver host not allowed`

**现象**

`/api/matrix/login` 返回：

```json
{"error":{"code":"FORBIDDEN","message":"Homeserver host not allowed"}}
```

**原因**

浏览器提交的 Matrix homeserver URL 不在服务端白名单内。

**解决**

确认 `MATRIX_ALLOWED_HOSTS` 包含你的访问域名，例如：

```yaml
MATRIX_ALLOWED_HOSTS: "dashboard.hiclaw.local,hiclaw-tuwunel.hiclaw-system,hiclaw-tuwunel.hiclaw-system.svc.cluster.local,localhost,127.0.0.1"
```

修改位置：`deploy/k3s-with-hiclaw/20-dashboard.yaml`。

同时确认 `hostAliases` 中 higress-gateway 的 cluster IP 正确：

```bash
kubectl -n hiclaw-system get svc higress-gateway -o jsonpath='{.spec.clusterIP}'
```

如果 IP 变了，同步更新 `20-dashboard.yaml` 中的 `hostAliases` 并重新部署。

### `.localhost` 域名浏览器强制 HTTPS

**现象**

访问 `http://hiclaw.localhost` 被浏览器自动跳转到 `https://hiclaw.localhost`，提示访问被拒绝。

**原因**

浏览器默认把 `.localhost` 视为本地安全域，强制 HTTPS。

**解决**

改用 `.local` 后缀（如 `dashboard.hiclaw.local`）或真实域名 / `nip.io`。

