# Security

TaDashboard is an internal operator console. It is **not** a public product and is deployed only alongside an authenticated HiClaw Controller.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security problems.

Send a private report to `security@hiclaw.local` with:

1. A short description of the vulnerability and its impact.
2. Reproduction steps (controller URL, payload, observed response).
3. Whether you have a working PoC. Attach only what is required to reproduce.

We aim to acknowledge within 3 business days and triage within 7 days. We coordinate disclosure timelines with reporters.

## Supported Versions

Only the latest minor release receives security fixes. Older versions are not patched.

## Hardening Notes for Operators

- Always deploy behind an authenticating reverse proxy (Caddy, nginx, envoy). The dashboard itself does not authenticate users.
- Set `MATRIX_ALLOWED_HOSTS` to a strict allow-list. Never use `*` in production.
- Run with `DATABASE_URL` pointing to a persistent volume. Audit log entries are lost on container restart if the SQLite file lives on an ephemeral filesystem.
- Use Kubernetes projected ServiceAccount tokens (see `k8s/dashboard-deployment.yaml`). Do not bake long-lived API tokens into pods.
- The container runs as non-root (`nextjs:1001`) with `readOnlyRootFilesystem: true`. Do not relax these in production manifests.
- Set `NEXT_PUBLIC_MATRIX_TOKEN_PERSIST=session` (the default) for shared workstations. Use `local` only on trusted single-user machines. Use `none` for screen-sharing / kiosk deployments.
- Rotate HiClaw Controller bearer tokens on operator offboarding. The dashboard re-reads `NEXT_PUBLIC_HICLAW_CONTROLLER_TOKEN` on each request.

## Known Limitations

- The dashboard does not currently implement CSRF protection on its own API routes. All `/api/*` requests must therefore go through a same-origin reverse proxy.
- `recordAudit` is best-effort: if `/api/audit` is unreachable, the action still succeeds and only a toast is lost. Operators relying on audit completeness should monitor Prisma logs.