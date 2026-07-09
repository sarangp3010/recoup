# Recoup

Local-first health & recovery companion for iOS + Android, built with React Native.

## Packages

- **`@recoup/protocol`** — parser for the wearable strap's BLE stream: a
  streaming deframer, CRC-8/16/32 validation, and typed data-packet payload
  summaries (history, optical, raw-motion). Fixture-driven tests: 29 passing,
  8 deferred to future packages.
- **`@recoup/algorithms`** — health-metric scoring engines: HRV, sleep, strain,
  recovery, and stress, plus recovery calibration and a HealthKit sync dry-run
  planner. 8 fixtures passing.

## Development

Requires Node >= 20 and pnpm.

```sh
pnpm install
pnpm -r typecheck
pnpm -r test
```

Fixtures and their expected outputs live in `packages/protocol/fixtures/`
(`index.json` is the single source of truth for the whole repo).

## Docs

- `docs/PROJECT.md` — roadmap, board, decisions, and active backlog
- `docs/PLAN.md` — detailed product and architecture plan for device ingestion,
  storage, and future algorithms

## Status

Early. Protocol parsing and metric scoring are implemented and tested; the
mobile app is scaffolded and includes an early dashboard demo, while live device
connectivity, persistence, and production data flows are still ahead.
