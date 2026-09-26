# Quaere

A game to give debate structure and leave informative artifacts.

A patron funds a bounty. A claimant stakes a claim and a certainty. The
audience challenges it, judges every response, and votes twice — once
before the case, once after. The claimant is paid for how far the room
moved, not for ending in agreement. Every case adds to a Record: an
accumulating file of every attempt made on that claim.

## Structure

This is a pnpm monorepo, deliberately split so the real multiplayer game
and the single-user demo never share state or a codepath for anything
that touches scoring:

- **`packages/rules`** — framework-agnostic TypeScript with no I/O: the
  settled game rules (trimmed-median audience certainty, calibration,
  verdicts, the grade formula, escrow/payout splitting) as pure, unit-tested
  functions. Both apps below import this rather than each computing scores
  their own way.
- **`apps/web`** — the real multiplayer app: Next.js + Postgres (via
  Prisma) + a small credentials-based auth layer. This is where the bounty
  board actually lives: a patron posts a call, claimants answer it with
  their own claim and certainty, and the patron picks one to run the case.
  Round play (challenges, defense, votes, verdict) is modeled in the schema
  but not yet built past that point — that's the next milestone.
- **`apps/demo`** — a single-user, no-backend demo: one person plays every
  role (patron, claimant, audience) to feel the full case flow end to end,
  persisted to that browser's local storage only. It shares `packages/rules`
  with the real app, but nothing else — no account, no server, no other
  players.

## Setup

```bash
pnpm install
```

### `apps/web` (multiplayer)

Needs a local Postgres. Copy `apps/web/.env.example` to `apps/web/.env` and
point `DATABASE_URL` at it (set your own `SESSION_SECRET` too), then:

```bash
cd apps/web
npx prisma db push   # create the schema
pnpm dev              # http://localhost:3000
```

### `apps/demo` (single-user)

No database or env needed:

```bash
pnpm --filter @quaere/demo dev   # http://localhost:3001
```

### Tests

```bash
pnpm test   # runs packages/rules' vitest suite
```

