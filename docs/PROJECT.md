# Recoup — Project Board

Local-first health & recovery companion for iOS + Android (React Native / Expo).
This is the single source of truth for planning: roadmap, backlog, sprint board,
done log, and decisions. Keep it updated as work moves.

- **Last updated:** 2026-07-08
- **Repo:** `github.com/sarangp3010/recoup` (private)
- **Stack:** pnpm workspace · TypeScript (strict) · Vitest · Expo SDK 57 / RN 0.86 / React 19

---

## Status snapshot

| Area | State |
|---|---|
| `@recoup/protocol` (BLE frame/payload parser) | ✅ v0 implemented + tested (29 pass, 8 deferred) |
| `@recoup/algorithms` (metric scoring) | ✅ v0 implemented + tested (8 fixtures pass) |
| `apps/mobile` (Expo app shell) | ✅ scaffolded + wiring verified (typecheck + `expo export`) |
| BLE connectivity | ⬜ not started |
| Persistence & sync | ⬜ not started |
| Health platform writes (HealthKit / Health Connect) | 🟡 dry-run planner only |
| UI / screens / charts | 🟡 single demo screen |
| CI / release | ⬜ not started |

Legend: ✅ done · 🟡 partial · ⬜ not started · 🔴 blocked

---

## Roadmap (milestones)

- **M0 — Foundations** ✅ *(done 2026-07-08)*
  Monorepo, protocol parser, metric engines, app shell, GitHub repo.
- **M1 — Device connectivity** ⬜
  Connect to a real strap over BLE, stream frames through `@recoup/protocol`, show live HR.
- **M2 — Local data & metrics UI** ⬜
  Persist decoded data, run the metric engines on real history, screens for recovery/sleep/strain/stress.
- **M3 — Health integration & polish** ⬜
  HealthKit / Health Connect writes via the sync planner, onboarding, charts, settings.
- **M4 — Beta** ⬜
  TestFlight / internal Android track, calibration on real data, stability.

---

## Sprint board

### 🔨 Now (current focus)
_Nothing in progress — pick from Next._

### ⏭️ Next (ready, prioritized)
- [ ] **REC-11** CI: GitHub Actions running `pnpm -r typecheck` + `pnpm -r test` on PRs — _S_
- [ ] **REC-12** Add `expo-router` and a tab shell (Today / Trends / Settings) — _M_
- [ ] **REC-20** BLE spike: evaluate `react-native-ble-plx` vs Expo BLE; connect + notify on the strap's stream UUID — _L_
- [ ] **REC-21** Wire BLE notifications into `FrameAccumulator` → `parseFrame` → render live HR — _L_

### 🗂️ Backlog (not yet scheduled)
- [ ] **REC-30** Persistence layer (SQLite / MMKV) for decoded packets + computed metrics — _L_
- [ ] **REC-31** Sync/session engine: assemble history packets into daily records — _L_
- [ ] **REC-40** Recovery / Sleep / Strain / Stress screens backed by `@recoup/algorithms` — _L_
- [ ] **REC-41** Charts (trends, sparklines) — pick a chart lib compatible with RN — _M_
- [ ] **REC-50** HealthKit writes for planned candidates (feed `runHealthSyncDryRun` output to real writes) — _L_
- [ ] **REC-51** Health Connect (Android) equivalent + mapping table — _L_
- [ ] **REC-60** Build owning packages for the deferred fixtures (see below) — _M_
- [ ] **REC-61** Recovery calibration pipeline on real captured data — _M_
- [ ] **REC-70** Onboarding + device pairing flow — _M_
- [ ] **REC-71** App icon / splash / brand assets (replace Expo defaults) — _S_

Sizes: _S_ ≈ <½ day · _M_ ≈ 1–2 days · _L_ ≈ 3+ days.

---

## ✅ Done log

### 2026-07-08 — M0 Foundations
- [x] **REC-01** pnpm monorepo (workspace, TS strict base config, Vitest)
- [x] **REC-02** `@recoup/protocol`: streaming deframer, CRC-8/16/32, frame/payload parsing, data-packet summaries
- [x] **REC-03** Protocol fixture-driven test suite (29 passing, 8 deferred) + fixture integrity checks
- [x] **REC-04** `@recoup/algorithms`: HRV, sleep, strain, recovery, stress engines
- [x] **REC-05** `@recoup/algorithms`: recovery calibration (OLS, date-split) + HealthKit sync dry-run planner
- [x] **REC-06** Algorithm fixture parity tests (8 passing; numeric epsilon tolerance)
- [x] **REC-07** Rebrand to **Recoup** — removed all `goose`/`whoop`/port-origin references across code, fixtures, schemas, filenames; `DeviceType GOOSE → GEN5`; `goose.* → recoup.*`
- [x] **REC-08** Renamed project directory `goose-mobile → recoup`
- [x] **REC-09** Created private GitHub repo and pushed
- [x] **REC-10** Scaffolded `apps/mobile` (Expo SDK 57 / RN 0.86 / React 19), wired workspace packages, monorepo Metro config + `.js→.ts` resolver; verified via typecheck and `expo export` (589 modules, no resolution errors)

---

## Deferred work (fixtures exist, owning code does not)

These fixtures are in `packages/protocol/fixtures/` and are intentionally skipped
by tests until their package is built (tracked as **REC-60**):

- `recoup.debug-ws-contract.v1` — local debug WebSocket bridge stream contract
- `recoup.calibration-dataset.v1` extras / reference-comparison fixtures (`openrecoup_*`)
- activity sessions / candidates fixtures
- `recoup_v5_historical_sync_gen5_dry_run_command_validation` — historical sync command builder

---

## Definition of Done

A story is Done when:
1. Code + types compile (`pnpm -r typecheck` clean).
2. Tests exist and pass (`pnpm -r test`); new logic has fixture or unit coverage.
3. For app-facing work: it bundles (`expo export`) and runs on at least one platform.
4. No `goose`/`whoop`/port-origin references introduced (see DEC-002).
5. Committed with a plain message (no AI attribution) and pushed.

---

## Decision log (ADR-lite)

- **DEC-001** — Monorepo: pnpm workspace, TypeScript strict, Vitest. Packages ship
  TS source (`main` → `src/index.ts`) rather than a build artifact.
- **DEC-002** — Recoup is an original product. The tokens `goose` and `whoop` must
  not appear anywhere in the repo. Structural identifiers were rebranded
  (`recoup.*`, `DeviceType GEN5`) in lockstep with fixtures so tests stay green.
- **DEC-003** — App is **Expo (managed)** for iOS + Android. Monorepo requires a
  custom `metro.config.js` (workspace watch/resolution) plus a `.js→.ts` resolver
  because the packages use ESM `.js` import specifiers over TS source.
- **DEC-004** — Metrics are validated by fixture parity. Numbers compare within a
  relative epsilon (last-ULP IEEE-754 differences are expected); strings/ints strict.
- **DEC-005** — Git commits are plain (no `Co-Authored-By` / AI attribution).

---

## Risks & open questions

- **BLE access** — connecting to the strap requires its GATT service/characteristic
  UUIDs and pairing flow; unverified against a live device yet. (blocks M1)
- **Package consumption in RN** — the `.js→.ts` Metro resolver works for `expo export`;
  re-verify on a device build and when adding more packages.
- **Health writes** — HealthKit/Health Connect require entitlements + permission UX;
  the dry-run planner encodes the rules but real writes are unbuilt.
- **Calibration data** — needs real labeled data to be meaningful beyond synthetic fixtures.

---

## How to use this board

- Move items **Backlog → Next → Now → Done log** as they progress; keep one small set in **Now**.
- Give every item a `REC-<n>` id; reference it in commit messages (e.g. `REC-12: add tab shell`).
- Update **Status snapshot** and **Last updated** whenever a milestone or area changes state.
- Record any notable technical/product choice as a new `DEC-<n>`.
