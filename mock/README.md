# Mock HiClaw Controller

A self-contained Node.js HTTP server that imitates the HiClaw Controller API
just enough for the dashboard UI to render against. State is held in memory
and seeded with one team, two workers, one human, one manager, and one
gateway consumer.

## Run

```bash
node scripts/mock-hiclaw.mjs           # 127.0.0.1:8090 (loopback only)
PORT=8091 node scripts/mock-hiclaw.mjs # custom port
MOCK_RESET=1 node scripts/mock-hiclaw.mjs # wipe state on boot
MOCK_HOST=0.0.0.0 node scripts/mock-hiclaw.mjs # expose on LAN (demo only)
```

The mock binds to loopback by default to avoid accidentally exposing a fake
controller on the LAN. Set `MOCK_HOST=0.0.0.0` only when you actually need a
phone or another laptop to reach it (e.g. demos).

## Wire to the dashboard

Set in `.env.local`:

```ini
NEXT_PUBLIC_HICLAW_CONTROLLER_URL=http://127.0.0.1:8090
HICLAW_CONTROLLER_URL=http://127.0.0.1:8090   # server-side proxy default
HICLAW_ALLOWED_HOSTS=127.0.0.1,localhost
```

Then `npm run dev` and open the dashboard. The connection banner will read
"connected" against the mock.

## Endpoints

All endpoints return JSON unless noted. Errors use the same envelope as the
real controller so the dashboard's `ApiClientError` parsing works unchanged.

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/healthz` | text/plain `ok` (matches `/api/hiclaw/healthz` contract) |
| GET    | `/version` | `{ controller, kubeMode }` |
| GET    | `/cluster-status` | `{ kubeMode, totalWorkers, totalTeams, totalHumans }` |
| GET    | `/infrastructure` | minio / higress / matrix / kubernetes / controller health |
| GET    | `/workers` | `{ workers, total }` |
| GET    | `/workers/{name}` | worker record |
| POST   | `/workers` | create |
| PUT    | `/workers/{name}` | update |
| DELETE | `/workers/{name}` | 204 |
| POST   | `/workers/{name}/wake` | `{ name, phase }` |
| POST   | `/workers/{name}/sleep` | `{ name, phase }` |
| POST   | `/workers/{name}/ensure-ready` | `{ name, phase }` |
| GET    | `/workers/{name}/status` | worker record |
| GET    | `/teams` | `{ teams }` |
| GET    | `/teams/{name}` | team record |
| POST   | `/teams` | create (accepts `leader` or `admin`) |
| PUT    | `/teams/{name}` | update |
| DELETE | `/teams/{name}` | 204 |
| GET    | `/humans` | `{ humans }` |
| GET / POST / PUT / DELETE | `/humans[/{name}]` | per-human CRUD |
| GET    | `/managers` | `{ managers }` |
| GET / POST / PUT / DELETE | `/managers[/{name}]` | per-manager CRUD |
| GET / POST | `/gateway/consumers` | consumer list / create |
| POST   | `/gateway/consumers/{id}/bind` | 204 |
| DELETE | `/gateway/consumers/{id}` | 204 |
| POST   | `/packages` | multipart upload → `{ packageUri }` |

## Seed data

- workers: `alice` (Running), `bob` (Pending)
- teams: `team-alpha`
- humans: `demo`
- managers: `lead`
- consumers: `gateway-1`

Reset with `MOCK_RESET=1`.

## Limits

- No authentication. Do not expose this server outside localhost.
- State is lost when the process exits.
- Errors are intentionally lightweight: 400 for malformed JSON, 404 for
  unknown IDs, 204 for deletes. They are not a substitute for the real
  controller's validation.