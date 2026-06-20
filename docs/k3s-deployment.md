# Deploying TaDashboard on local k3s

This guide gets TaDashboard plus a mock HiClaw Controller running on a single-node k3s cluster on your laptop. Swap the mock for the real controller image once it ships.

## Prerequisites

| Tool    | Version    | Why                                    |
|---------|------------|----------------------------------------|
| k3s     | v1.31+     | Cluster runtime                        |
| kubectl | matches k3s | Apply manifests                        |
| helm    | 3.10+      | Install Higress                        |
| docker  | 24+        | Build the dashboard image              |
| Node.js | 20+        | Run `scripts/mock-hiclaw.mjs` if not using Docker |

### Why disable Traefik

k3s installs Traefik as its default ingress controller. HiClaw uses
**Higress** as the external API gateway (Consumer credential injection,
rate limiting, TLS). Both bind ports 80/443 on every node and both register
their own `IngressClass`. Running them side-by-side is not supported —
Traefik will keep claiming the standard `networking.k8s.io/v1` Ingress
resources and Higress will fail to bind the ports.

Install k3s with Traefik disabled:

```bash
curl -sfL https://get.k3s.io | sh -s - --disable=traefik
sudo kubectl get nodes
```

If k3s is already running with Traefik, either:

```bash
sudo kubectl -n kube-system scale deploy traefik --replicas=0
```

to stop it temporarily, or edit `/etc/rancher/k3s/config.yaml` to add
`disable: [traefik]` and `sudo systemctl restart k3s` for a permanent fix.

The kubeconfig lives at `/etc/rancher/k3s/k3s.yaml`. Copy it to `~/.kube/config` or export `KUBECONFIG=...` for each shell.

## Architecture

```
browser ──https://hiclaw.localhost──> Higress (gateway)
                                          │  TLS + Consumer auth + rate-limit
                                          ▼
                                hiclaw-dashboard:3000 (Next.js)
                                          │  in-cluster proxy
                                          ▼
                                hiclaw-controller:8090 (mock or real)
```

The dashboard runs the same `/api/hiclaw/*` Next.js proxy routes in-cluster
as it does on your laptop. The proxy reads `HICLAW_CONTROLLER_URL` from the
pod environment, which points at the in-cluster Service DNS.

## 1. Install Higress

```bash
scripts/install-higress.sh
```

What this does:

- Adds the `higress.io` Helm repo and updates it.
- `helm upgrade --install higress higress.io/higress -n higress-system --create-namespace`.
- Waits for `higress-controller` to be Ready.
- Verifies the `higress` IngressClass is registered.

If Traefik is still installed the script prints a warning and prompts for
confirmation. To proceed anyway, you must first scale Traefik to zero so the
ports are free; Higress will still fail to bind them otherwise.

For a Chinese mirror, set `HIGRESS_HUB_MIRROR=higress-registry.cn-hangzhou.cr.aliyuncs.com` before running.

## 2. Build the image

```bash
cp .env.k3s.example .env.k3s.local
# edit if you want a custom tag or registry
scripts/build-and-load-image.sh
```

What this does:

- `docker build` from the repo's `Dockerfile` produces `hiclaw-dashboard:dev`
- `k3s ctr images import` loads that tar into the cluster's containerd so
  pods can pull it without a registry

For multi-node clusters, set `DASHBOARD_REGISTRY=ghcr.io/you` in
`.env.k3s.local` and the script will push there instead.

## 3. Apply manifests

```bash
scripts/deploy-k3s.sh
```

The script first verifies that the `higress` IngressClass is registered and
warns (and prompts) if Traefik is still running. Then it applies everything
under `deploy/k3s/` via kustomize:

- `Namespace` + RBAC labels enforcing `restricted` pod security standard
- `ServiceAccount`s for dashboard and controller
- PVCs for the dashboard SQLite file (1Gi) and the controller's data dir (5Gi)
- `Deployment` + `Service` for both workloads
- `Ingress` with `ingressClassName: higress` terminating TLS at `hiclaw.localhost`

### Prisma schema push on first boot

The dashboard Deployment uses an `initContainer` named `migrate` that runs
`npx prisma db push --skip-generate --accept-data-loss` against the PVC
before the app container starts. This guarantees the SQLite schema exists on
the first deploy, otherwise `db.auditLog.create()` (and every other Prisma
write) would fail with `SQLITE_CANTOPEN`. The init container shares the same
`hiclaw-dashboard:dev` image, mounts the `db` PVC, runs as the same
non-root UID, and exits before the main container takes over.

`scripts/deploy-k3s.sh` waits for both rollouts to complete.

## 4. Reach the dashboard

Add the k3s node IP to `/etc/hosts`:

```bash
echo "$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[0].address}') hiclaw.localhost" | sudo tee -a /etc/hosts
```

Then open <https://hiclaw.localhost>. The first request will hit the
self-signed Higress default certificate; accept the warning. The dashboard
will report "connected" because the mock controller is running in the same
cluster.

To use the dashboard's `Matrix` features, point `NEXT_PUBLIC_MATRIX_API_URL`
in `.env.k3s.local` at a real homeserver and rebuild.

## 5. Verify

```bash
kubectl -n hiclaw-system get pods,svc,ingress,pvc
kubectl -n hiclaw-system logs deploy/hiclaw-controller --tail=50
kubectl -n hiclaw-system logs deploy/hiclaw-dashboard --tail=50
kubectl -n higress-system get pods
```

Confirm the Ingress is bound to the Higress gateway:

```bash
kubectl -n hiclaw-system describe ingress hiclaw-dashboard
# Events should show Higress controller picked it up.
```

## TLS

`deploy/k3s/41-hiclaw-ingress.yaml` references `secretName: hiclaw-dashboard-tls`. The script does **not** create this secret — you have two options:

1. **Self-signed for development** — `kubectl create secret tls hiclaw-dashboard-tls --cert=... --key=...` with locally generated certs (e.g. `mkcert` or `openssl req -x509 ...`).
2. **Real cert via Higress + Gateway API** — Higress prefers cert management through its own Gateway API integration. Define a `Gateway` resource with a `tls.certificateRefs[].name=hiclaw-dashboard-tls` and provision the secret with cert-manager or your internal CA.

For day-to-day local work, drop the `tls:` block from the Ingress and let Higress serve plain HTTP on port 80.

## Switching from mock to the real controller

1. Set `CONTROLLER_MODE=real` in `.env.k3s.local`.
2. Build the real controller image (out of scope here).
3. Edit `deploy/k3s/30-hiclaw-controller.yaml`:
   - `image:` → your controller image
   - remove `command:` and the mock env vars
   - keep the port (`8090`), probes, and security context
4. Re-run `scripts/build-and-load-image.sh` if your controller shares the dashboard image, or `docker push` if it's separate.
5. `scripts/deploy-k3s.sh` will re-apply the manifests and roll the controller pod.

## Wasm plugins on Higress

HiClaw's gateway features (Consumer auth, rate-limiting) are usually
expressed as `extensions.higress.io/v1alpha1` `WasmPlugin` resources that
match the dashboard Ingress. They live in the `higress-system` namespace
and reference the `hiclaw-dashboard` Ingress by name in `spec.matchRules`.
See the [Higress plugin catalogue](https://higress.io/en/plugins/) for
ready-to-use plugins.

## Authentication between dashboard and controller

The dashboard's `HICLAW_AUTH_TOKEN` (or `HICLAW_AUTH_TOKEN_FILE`) is forwarded as `Authorization: Bearer ...` on every proxy request. In k3s the file path
points at a projected ServiceAccount token that rotates hourly.

To enable it:

1. Set `HICLAW_AUTH_TOKEN` in `.env.k3s.local` (or rely on the projected token).
2. Update the controller to validate that token against an expected audience (`hiclaw-controller`).

If you do not enable auth, the dashboard still works, but anyone who can reach `hiclaw-controller.hiclaw-system:8090` from inside the cluster can call the API.

## Rollback

```bash
kubectl -n hiclaw-system rollout undo deploy/hiclaw-dashboard
kubectl -n hiclaw-system rollout undo deploy/hiclaw-controller
```

For a full teardown:

```bash
scripts/teardown-k3s.sh             # delete workloads, keep PVCs
scripts/teardown-k3s.sh --purge-pvc # also delete database volumes
scripts/teardown-k3s.sh --purge-all # also delete the namespace
scripts/uninstall-higress.sh        # drop the Higress Helm release
```

If you want to bring Traefik back later (for a different workload), edit
`/etc/rancher/k3s/config.yaml` to remove `disable: [traefik]` and
`sudo systemctl restart k3s`.

## Known limitations

- The mock controller stores state in memory. Restarting the pod wipes it. Pass `MOCK_RESET=0` (default) to keep the seed; pass `MOCK_RESET=1` to start empty.
- The Ingress uses a self-signed cert. Do not use the dashboard over a hostile network without rotating to a trusted cert.
- Single replica. For HA, raise `spec.replicas` and add a `PodDisruptionBudget`.
- No NetworkPolicies are applied. The `restricted` pod security standard prevents privilege escalation, but pod-to-pod traffic is unrestricted by default in k3s. Add NetworkPolicies if you run untrusted workloads in the same cluster.
- The mock image runs `node scripts/mock-hiclaw.mjs` as PID 1, which means the process handles SIGTERM directly. There is no init wrapper.
- Higress and Traefik cannot coexist on the same node. Do not re-enable Traefik without first uninstalling Higress.
- Higress does not watch standard Ingress by default across all versions; if the `higress` IngressClass is registered but the Ingress never gets an address, check `kubectl -n higress-system logs deploy/higress-controller` for the supported annotation set.