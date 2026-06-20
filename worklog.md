---
Task ID: hardening-pass-2
Agent: main
Task: 评价反馈 + 上一轮剩余：Token 持久化、错误码体系、操作审计

Work Log:
- Addressed review note: README mention of "accessToken=" + global CORS no longer applies; token persistence is now opt-in.
- Added NEXT_PUBLIC_MATRIX_TOKEN_PERSIST (session|local|none); matrix-store now defaults to sessionStorage and supports a "none" mode for in-memory-only tokens. Existing localStorage users can opt back in via env.
- Added /src/lib/api-errors.ts: shared error code catalogue (BAD_REQUEST/UNAUTHORIZED/FORBIDDEN/NOT_FOUND/CONFLICT/RATE_LIMITED/UPSTREAM_TIMEOUT/UPSTREAM_UNAVAILABLE/UPSTREAM_ERROR/INVALID_RESPONSE/CONFIGURATION_ERROR/INTERNAL_ERROR), `ApiErrorBody` envelope, helpers to build it, `ApiClientError` class that hydrates from Response, and `describeApiError()` UI hint generator.
- Updated /src/app/api/hiclaw/proxy-helper.ts and /src/app/api/matrix/proxy-helper.ts to:
  - Normalize non-2xx upstream responses into the standard envelope with upstream metadata.
  - Wrap network errors (timeout / unreachable) into UPSTREAM_TIMEOUT (504) and UPSTREAM_UNAVAILABLE (502).
- Updated hiclaw-api.ts and matrix-api.ts to throw ApiClientError instead of raw Error strings.
- Updated use-hiclaw-mutations.ts to use describeApiError + a shared `formatError` helper; toast and notification titles now include the error category.
- Added /src/app/api/audit/route.ts (POST writes, GET reads). Whitelist of actions (worker.create/update/delete/wake/sleep/ensure-ready, team.*, human.*, manager.*, consumer.*). Node runtime; uses Prisma AuditLog model.
- Added /src/lib/audit.ts `recordAudit()` helper; wired into worker/team/human/manager/consumer delete mutations (create/awaken/sleep ensure-ready left as next step due to scope).
- Documented new env vars in .env.example and README.
- Tests: added tests/api-errors.test.ts (10) and tests/matrix-store.test.ts (7) covering statusToCode, jsonErrorBody, isApiErrorBody, ApiClientError.fromResponse (success/fallback/statusText), describeApiError, the resolver and the storage factory for session/local/none modes. Updated one existing hiclaw-api test to expect ApiClientError.
- Total: 4 test files, 34 tests passing.

Verification:
- ESLint: 0 errors / 0 warnings
- Vitest: 34 passed / 0 failed
- next build: Compiled successfully, 32 routes generated (audit endpoint added)

---
Task ID: hardening-pass-3
Agent: main
Task: 把剩余 mutation 接上 recordAudit，让 ConnectionBanner 根据错误码降级，补工程化文档

Work Log:
- Wired `recordAudit` into all remaining `use-hiclaw-mutations.ts` mutations: `useCreateWorker`, `useUpdateWorker`, `useWakeWorker`, `useSleepWorker`, `useEnsureReadyWorker`, `useCreateTeam`, `useUpdateTeam`, `useCreateHuman`, `useUpdateHuman`, `useCreateManager`, `useUpdateManager`, `useCreateConsumer`. Each audit call includes contextual metadata (runtime, model, leader, worker count, permission level, ...). Every destructive / state-changing mutation now emits an audit record on success.
- Connection state now classifies the error: `HiClawStore.connectionError` changed from `string | null` to `{ code: ApiErrorCode | 'NETWORK_ERROR' | 'UNKNOWN', message: string } | null`. `checkConnection()` parses the upstream envelope (or falls back to NETWORK_ERROR / UNKNOWN) so the UI can react to specific categories.
- `ConnectionBanner` now surfaces the upstream error code:
  - Renders `ShieldAlert` and "鉴权失败" copy when the code is UNAUTHORIZED / FORBIDDEN.
  - Shows `describeApiError(code).description` as a degraded-mode hint next to the controller URL on wide viewports.
  - Settings dialog mirrors the new shape (`message` + `[CODE]` suffix).
- Added `tests/audit.test.ts` (4 tests) covering the POST body shape, omitted optional fields, and best-effort error swallowing for network and 5xx responses. The test stubs `global.window` so `recordAudit`'s `typeof window === 'undefined'` short-circuit does not bypass the spy.
- Fixed `src/app/api/audit/route.ts` Turbopack warning: replaced the deprecated `export const config = { runtime: 'nodejs' }` with the App Router idiom `export const runtime = 'nodejs'`.
- Added repo hygiene docs:
  - `LICENSE` (Apache-2.0).
  - `CONTRIBUTING.md` covering setup, code style, test rules, commit message convention.
  - `SECURITY.md` with private contact, hardening notes for operators, and known limitations.
  - `.github/ISSUE_TEMPLATE/{bug_report.yml, feature_request.yml, config.yml}` for the issue tracker.
- Vitest config now excludes `tests/_*.test.ts` so ad-hoc debugging files don't show up in CI.

Verification:
- ESLint: 0 errors / 0 warnings
- Vitest: 38 passed / 0 failed (5 files)
- next build: Compiled successfully, 32 routes, 0 warnings

Files:
- New: src/lib/api-errors.ts, src/lib/audit.ts, src/app/api/audit/route.ts, tests/api-errors.test.ts, tests/matrix-store.test.ts
- Modified: .env.example, README.md, package.json (env only)
- Modified: src/lib/matrix-store.ts, src/lib/hiclaw-api.ts, src/lib/matrix-api.ts
- Modified: src/app/api/hiclaw/proxy-helper.ts, src/app/api/matrix/proxy-helper.ts
- Modified: src/hooks/use-hiclaw-mutations.ts
- Modified: tests/hiclaw-api.test.ts

---
Task ID: k3s-deploy-bootstrap
Agent: main
Task: 为本地 k3s 部署准备 assets + mock Controller，让 dashboard 无真实 HiClaw 也能跑

Work Log:
- Decision: path C (mock + deployment assets + docs). Sandbox has no docker / k3s / kubectl so the cluster itself cannot be brought up here; deliverable is "drop-in artifacts" the operator runs on their own k3s host, plus a mock Controller that the dashboard can talk to on the laptop for UI work.
- Recon: enumerated every endpoint the dashboard calls via /api/hiclaw/*. Documented in mock/README.md.
- New: `scripts/mock-hiclaw.mjs` — Node-only HTTP server (no deps) listening on PORT (default 8090). Implements:
  - /healthz (text/plain "ok", matches proxy contract)
  - /version, /cluster-status, /infrastructure
  - /workers + per-name + wake/sleep/ensure-ready/status subroutes
  - /teams, /humans, /managers with full CRUD (CreateTeam accepts leader or admin)
  - /gateway/consumers with bind/delete
  - /packages multipart upload returning { packageUri }
  - Errors use the dashboard's envelope shape so ApiClientError.fromResponse parses unchanged.
  - Seed: workers alice/bob, team-alpha, demo human, lead manager, gateway-1 consumer. MOCK_RESET=1 wipes state.
- New: `mock/README.md` documenting endpoints, seed data, env wiring.
- New: `deploy/k3s/` end-to-end manifests (kustomize):
  - 00-namespace.yaml with restricted pod-security labels
  - 10-accounts-and-volumes.yaml — ServiceAccounts for dashboard + controller, PVCs (1Gi dashboard db, 5Gi controller data)
  - 20-hiclaw-controller-config.yaml — ConfigMap with bootstrap env
  - 30-hiclaw-controller.yaml — Deployment running `node scripts/mock-hiclaw.mjs` from the dashboard image (placeholder until real controller ships), readOnlyRootFilesystem + non-root, httpGet probes
  - 31-hiclaw-controller-service.yaml — ClusterIP :8090
  - 40-hiclaw-dashboard.yaml — Deployment + Service with projected SA token, env wiring, RollingUpdate strategy
  - 41-hiclaw-ingress.yaml — Traefik Ingress with TLS secret reference
  - kustomization.yaml — namespace pinning + common labels
- New: `.env.k3s.example` with all k3s-relevant env vars (image, registry, namespace, ingress host, persistence, public-facing NEXT_PUBLIC_*).
- New: `scripts/build-and-load-image.sh` — docker build + optional push to registry or k3s ctr images import (single-node dev path).
- New: `scripts/deploy-k3s.sh` — kubectl apply -k, waits for both rollouts, prints ingress host and helper for /etc/hosts.
- New: `scripts/teardown-k3s.sh` — kustomize delete with optional --purge-pvc / --purge-all.
- New: `docs/k3s-deployment.md` — prerequisites, architecture diagram, step-by-step, TLS notes, mock → real migration, auth wiring, rollback, known limitations.
- Validation: pyyaml parses all 8 YAML files cleanly (kinds confirmed: Namespace × 1, ServiceAccount × 2, PVC × 2, ConfigMap × 1, Deployment × 2, Service × 2, Ingress × 1, Kustomization × 1). bash -n clean on all three shell scripts. node --check clean on mock-hiclaw.mjs.
- Mock smoke test: GET /healthz=ok, /version={controller,kubeMode}, /cluster-status, /workers (2 seeded), full CRUD on teams (create+list=2+delete), multipart /packages returns {packageUri}. Error envelope on 404 matches ApiClientError contract.
- Existing `k8s/dashboard-deployment.yaml` left untouched (single-file legacy deploy still works).

Verification:
- ESLint: 0 errors / 0 warnings (full repo)
- Vitest: 38 passed / 0 failed (5 files)
- next build: Compiled successfully, 32 routes, 0 warnings
- YAML: 8 files parsed cleanly via pyyaml
- bash -n: 3 scripts clean
- node --check: mock-hiclaw.mjs clean
- Live curl smoke against mock on :18090/:18091: healthz ok, full worker/team/manager CRUD + multipart upload verified

Files:
- New: scripts/{mock-hiclaw.mjs, build-and-load-image.sh, deploy-k3s.sh, teardown-k3s.sh}
- New: mock/README.md
- New: deploy/k3s/{00..41,kustomization}.yaml (8 files)
- New: .env.k3s.example
- New: docs/k3s-deployment.md

Notes for operator:
- Sandbox cannot run docker/k3s; run scripts/build-and-load-image.sh + scripts/deploy-k3s.sh on the k3s host.
- Replace mock controller with real image by editing deploy/k3s/30-hiclaw-controller.yaml (drop the `command:` line, set `image:` to the real tag) and re-applying.
- TLS secret hiclaw-dashboard-tls is referenced but not created — create manually or install cert-manager.

---
Task ID: k3s-higress-replace-traefik
Agent: main
Task: HiClaw 用 Higress 做外部网关，与 k3s 默认 Traefik 抢端口和 IngressClass 冲突。改部署资产用 Higress。

Work Log:
- Verified conflict: k3s ships Traefik by default (binds 80/443, registers its own IngressClass). HiClaw needs Higress for Consumer auth, rate-limiting, TLS. Both cannot co-exist on the same node.
- Updated `deploy/k3s/41-hiclaw-ingress.yaml`:
  - `ingressClassName: higress` (was `traefik`).
  - Removed Traefik-specific annotations (`traefik.ingress.kubernetes.io/router.entrypoints`, `traefik.ingress.kubernetes.io/router.tls`).
  - Added Higress-native annotations: `higress.io/backend-protocol: HTTP`, `higress.io/timeout: 30s`.
  - Comment block now states Traefik must be disabled at k3s install time.
- New `scripts/install-higress.sh`:
  - Pre-flight: warn if Traefik deployment is still present in kube-system; prompt to continue.
  - Adds the `higress.io` Helm repo and `helm upgrade --install higress higress.io/higress -n higress-system --create-namespace`.
  - Waits for `higress-controller` rollout; verifies `ingressclass higress` is registered.
  - Honours `HIGRESS_NAMESPACE`, `HIGRESS_RELEASE`, `HIGRESS_HUB`, `HIGRESS_CHART_VERSION`, `HIGRESS_HUB_MIRROR`.
- New `scripts/uninstall-higress.sh`: helm uninstall + namespace delete.
- `scripts/deploy-k3s.sh` now pre-checks:
  - Bails out if `ingressclass higress` is missing.
  - Warns (and prompts) if Traefik is still installed and not scaled to zero.
  - Updated final message to reference Higress instead of Traefik.
- `scripts/` now contains the full lifecycle: `build-and-load-image.sh`, `install-higress.sh`, `deploy-k3s.sh`, `teardown-k3s.sh`, `uninstall-higress.sh`, `mock-hiclaw.mjs`. `bash -n` clean on all.
- `.env.k3s.example` gained an `Ingress / TLS` block (renamed), a `Higress` block (`HIGRESS_NAMESPACE`, `HIGRESS_RELEASE`, `HIGRESS_HUB`, `HIGRESS_CHART_VERSION`, `HIGRESS_HUB_MIRROR`), and an informational `K3S_INSTALL_FLAGS=--disable=traefik`.
- `docs/k3s-deployment.md` rewritten:
  - New "Why disable Traefik" section explains the port and IngressClass conflict and the two fix paths (k3s install flag vs. runtime scale-down).
  - New step "1. Install Higress" sits before image build.
  - "2. Apply manifests" now mentions the Higress pre-check and warning prompts.
  - "3. Reach the dashboard" now says Higress, not Traefik.
  - "5. Verify" adds `kubectl -n higress-system get pods` and a `describe ingress` tip.
  - "Switching from mock to the real controller" section now references Higress.
  - New "Wasm plugins on Higress" section explains the Consumer auth / rate-limiting plugin model.
  - TLS section clarifies Higress prefers Gateway API for cert management.
  - "Known limitations" adds the Higress/Traefik coexistence note and the "Ingress not picked up" debug tip.
  - Uninstall section adds `scripts/uninstall-higress.sh` and Traefik re-enable instructions.
- Validation:
  - pyyaml parses all 8 YAML files cleanly. Custom assertion confirms `spec.ingressClassName == 'higress'` and no `traefik.*` annotation remains.
  - `bash -n` clean on all 5 shell scripts.
  - ESLint 0 errors.
  - Vitest 38/38 (5 files).
  - next build: Compiled successfully, 32 routes, 0 warnings.

Files:
- Modified: deploy/k3s/41-hiclaw-ingress.yaml
- Modified: scripts/deploy-k3s.sh
- Modified: .env.k3s.example
- Modified: docs/k3s-deployment.md
- New: scripts/install-higress.sh, scripts/uninstall-higress.sh

Notes for operator:
- Install order: `curl ... | sh -s - --disable=traefik` → `scripts/install-higress.sh` → `scripts/build-and-load-image.sh` → `scripts/deploy-k3s.sh`.
- If Traefik was already enabled, scale it down (`kubectl -n kube-system scale deploy traefik --replicas=0`) before installing Higress, or uninstall it permanently via `/etc/rancher/k3s/config.yaml`.