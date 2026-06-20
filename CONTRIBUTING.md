# Contributing

TaDashboard is an internal console for [HiClaw Controller](https://github.com/hiclaw/hiclaw-controller). It is intentionally narrow in scope and exists to surface cluster state for a single HiClaw fleet. Contributions that pull in unrelated features will be declined.

## Before You Open a PR

1. **Discuss first.** Open an issue describing the problem and the proposed solution. Wait for a maintainer to confirm scope before writing code.
2. **Keep the change small.** One logical change per PR. Split refactors from feature work.
3. **Match existing conventions.** Read `eslint.config.mjs`, `tsconfig.json`, and `next.config.ts` before introducing new tooling.

## Local Setup

```bash
# Node.js 20+ is required. bun is optional but preferred for installs.
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_HICLAW_CONTROLLER_URL and NEXT_PUBLIC_MATRIX_* values.

# Database (Prisma + SQLite) for the audit log
npx prisma migrate dev

# Run the dev server
npm run dev

# Run the test suite
npm run test

# Lint + type-check
npm run lint
npx tsc --noEmit
```

## Code Style

- TypeScript strict mode is enforced. No `any`, no `@ts-ignore` without a justification comment.
- All API client code must surface errors via `ApiClientError` from `src/lib/api-errors.ts`. Do not return raw `fetch` responses to the UI.
- Every destructive mutation (delete / wake / sleep / ensure-ready / permission change) MUST call `recordAudit` from `src/lib/audit.ts` on success.
- Server-side proxy routes live under `src/app/api/{hiclaw,matrix}/`. They MUST validate the upstream URL against the allow-list before forwarding. See `proxy-helper.ts` for the canonical pattern.
- Public client components begin with `'use client'` and live under `src/components/`.

## Tests

Vitest is the only test framework. Tests live next to the code they exercise (`src/**/*.test.ts`) or in `tests/` for cross-cutting concerns.

- New utilities require unit tests.
- New API error codes require updates to `tests/api-errors.test.ts`.
- New audit actions require updates to `src/lib/audit.ts` whitelist AND a vitest case verifying `recordAudit` serializes the payload.

## Commit Messages

Follow Conventional Commits:

```
feat(scope): short summary
fix(scope): short summary
chore(scope): short summary
refactor(scope): short summary
test(scope): short summary
docs(scope): short summary
```

## Security

Do not commit secrets, tokens, or production controller URLs. Use `.env.local`, which is git-ignored. See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities.