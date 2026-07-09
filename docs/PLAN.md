# Recoup — Product and Architecture Plan

This document turns the current ideas into one detailed plan we can build from
later. It is intentionally practical: what we are building, what assumptions are
safe, what risks exist, how data should flow, and how to phase the work.

- **Last updated:** 2026-07-09
- **Audience:** product, engineering, future contributors
- **Companion docs:** [Project Board](</Users/sarang_3010/Documents/Code/recoup/docs/PROJECT.md>)

---

## 1. Product intent

Recoup is a recovery and readiness app built around our own scoring models.

The long-term idea is:

1. Connect a wearable device.
2. Collect live physiological data from that device.
3. Save raw and derived data in our own storage.
4. Build our own algorithms for readiness, strain, recovery, sleep, stress, and
   coaching.
5. Improve those algorithms over time with real-world data rather than relying
   on another company's scores.

The core product is **not** "mirror another wearable app."

The core product is:

- own the ingestion pipeline
- own the stored data model
- own the feature extraction
- own the scoring logic
- own the product experience

---

## 2. Product goals

### Primary goals

- Connect to a wearable and receive live data reliably.
- Store data in a form that is reusable for future algorithms.
- Separate raw input signals from derived metrics.
- Build an app experience focused on recovery, strain, sleep, and coaching.
- Support multiple hardware/data sources over time.

### Secondary goals

- Run locally first, then sync to backend storage.
- Support both real-time views and historical trends.
- Keep the algorithm engine versioned so old scores can be reproduced.

### Non-goals for early versions

- Perfect medical-grade interpretation.
- Dependence on one specific wearable vendor forever.
- Reproducing every proprietary score from an external platform on day one.
- Shipping a broad social or community feature set before the data pipeline is stable.

---

## 3. Strategy: treat the wearable as a data source, not the product

This is the most important architectural decision.

We should not tightly bind Recoup to one wearable vendor. Some devices expose
rich BLE streams. Some expose only heart rate. Some expose processed cloud data
but not raw signals. That means the product architecture must center on a
**source adapter model**.

### Rule

Every integration should flow through a common adapter contract.

Example source types:

- `ble_live`
- `vendor_cloud`
- `health_platform_import`
- `manual_import`

Example adapter names:

- `Gen5BleAdapter`
- `HeartRateMonitorBleAdapter`
- `VendorApiAdapter`
- `HealthKitAdapter`
- `HealthConnectAdapter`

This keeps the app flexible if:

- a target strap exposes only limited BLE data
- we later add another device
- we want to compare two data sources
- we need a fallback ingestion path for some users

---

## 4. Reality check on third-party wearable access

Our long-term plan depends on **what the device actually exposes**.

There are three broad possibilities:

### Best case

The wearable exposes rich live BLE signals such as:

- heart rate
- RR intervals
- accelerometer / gyro
- skin temperature
- wear-state or contact-state
- battery
- timestamps or packet sequence ids

If this is true, we can build a strong proprietary pipeline.

### Middle case

The wearable exposes only partial live data, such as:

- heart rate
- maybe RR intervals
- maybe battery

This is still useful, but it limits how accurately we can rebuild advanced
recovery or strain models.

### Worst case

The wearable exposes only narrow live data and pushes most useful insights
through its own app or cloud APIs.

If this is true, then:

- BLE can support a live pulse view
- cloud/API data can support history and insights
- but fully reproducing the vendor's scoring from live device traffic alone may
  not be realistic

### Product implication

Before betting the company on one wearable, we should prove exactly what live
signals we can capture in practice.

That is why the first engineering milestone should be a **BLE ingestion spike**,
not a bigger UI buildout.

---

## 5. High-level system architecture

Recoup should be built in layers.

### Layer 1: Device/source adapters

Responsible for:

- scanning
- pairing/connecting
- subscribing to streams
- reading raw payloads
- normalizing source-specific events

Output:

- raw sample events
- source metadata
- connection state

### Layer 2: Session ingestion

Responsible for:

- session start/stop
- clock normalization
- packet ordering
- deduplication
- buffering
- retry on intermittent connection loss

Output:

- a continuous event stream with consistent timestamps

### Layer 3: Local persistence

Responsible for:

- caching raw events on-device
- storing computed summaries
- enabling offline product behavior

Output:

- queryable local history

### Layer 4: Sync and backend ingest

Responsible for:

- uploading session data
- batching
- conflict handling
- replay safety
- idempotent writes

Output:

- durable backend event store

### Layer 5: Feature extraction

Responsible for:

- converting raw events into features
- rolling windows
- sleep candidates
- baseline tracking
- workout/load proxies

Output:

- structured features for models

### Layer 6: Scoring engine

Responsible for:

- readiness/recovery score
- strain score
- sleep score
- stress score
- confidence and calibration metadata

Output:

- user-facing scores and explanations

### Layer 7: Product UI

Responsible for:

- live session screen
- daily recovery dashboard
- trends
- explanations
- device state
- data quality state

---

## 6. Recommended phase plan

### Phase 0: Planning and proof boundaries

Goal:

- understand what the target device can actually provide

Deliverables:

- documented source constraints
- adapter interface
- spike checklist

Success criteria:

- we know which signals are truly available live
- we know whether Expo Go is sufficient or whether a development build is required

### Phase 1: BLE ingestion prototype

Goal:

- connect to the device and stream live data

Deliverables:

- scan for device
- connect/disconnect flow
- subscribe to live characteristics
- show incoming sample rate and latest values
- save raw samples locally

Success criteria:

- stable connection for at least one full session
- raw events visible in app logs/storage

### Phase 2: Session recording and local storage

Goal:

- preserve incoming live data safely and query it later

Deliverables:

- session model
- event persistence
- local replay/debug screen
- session export for analysis

Success criteria:

- no silent loss during a typical session
- recorded data can be replayed through the parser/algorithm pipeline

### Phase 3: Backend sync

Goal:

- move from local-only capture to durable backend storage

Deliverables:

- ingest API
- user/device/session tables
- event upload worker
- idempotent batch writes

Success criteria:

- a recorded session syncs safely and can be queried remotely

### Phase 4: First-party features and metrics

Goal:

- compute useful internal metrics from stored signals

Deliverables:

- rolling HRV features
- heart-rate trends
- baseline calculations
- sleep/recovery candidate logic

Success criteria:

- real users can see metrics based on captured data, not placeholders

### Phase 5: Production product loop

Goal:

- make the system reliable, interpretable, and adaptive

Deliverables:

- calibration/versioning
- anomaly handling
- better UX around missing/low-quality data
- algorithm experiments

Success criteria:

- we can compare score versions and improve them deliberately over time

---

## 7. Mobile architecture direction

### Current state

Current app:

- Expo-managed React Native app
- monorepo workspace
- demo dashboard UI

### Near-term recommendation

For serious BLE work, plan for an Expo development build or bare-native path if
needed. Managed Expo is good for speed, but some hardware workflows become much
easier once native capabilities are under our control.

### Suggested app modules

- `apps/mobile/src/features/device`
- `apps/mobile/src/features/live-session`
- `apps/mobile/src/features/history`
- `apps/mobile/src/features/recovery`
- `apps/mobile/src/features/settings`

### Suggested client services

- `deviceManager`
- `sessionRecorder`
- `localStore`
- `syncQueue`
- `featureEngine`
- `scoreEngine`

---

## 8. Proposed adapter contract

This is the conceptual shape we should design around.

```ts
type SourceKind =
  | "ble_live"
  | "vendor_cloud"
  | "health_platform_import"
  | "manual_import";

type ConnectionState =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "streaming"
  | "disconnected"
  | "error";

type SignalType =
  | "heart_rate"
  | "rr_interval"
  | "motion"
  | "temperature"
  | "wear_state"
  | "battery"
  | "unknown";

interface RawSample {
  sourceKind: SourceKind;
  sourceDeviceId: string;
  signalType: SignalType;
  timestampMs: number;
  value: number | string | boolean;
  unit?: string;
  sequence?: number;
  quality?: "high" | "medium" | "low" | "unknown";
  rawHex?: string;
}
```

Notes:

- `rawHex` is valuable for debugging and future protocol work.
- `quality` should exist from day one.
- `sequence` helps detect packet loss and out-of-order delivery.

---

## 9. Data model and storage plan

We should store data at three levels.

### Level A: Raw events

What arrived from the device/source.

Examples:

- heart rate sample
- RR interval sample
- motion packet
- battery update

Why keep it:

- future algorithm improvements
- debugging
- reprocessing with new parsers/features

### Level B: Derived features

Computed from raw events.

Examples:

- 5-minute HRV window
- resting heart rate estimate
- rolling load estimate
- sleep segment candidates
- artifact flags

Why keep it:

- faster product queries
- reproducibility
- easier model iteration

### Level C: User-facing scores

High-level outputs shown in the app.

Examples:

- daily readiness
- daily strain
- sleep performance
- recovery trend

Why keep it:

- explain what the user saw on a given day
- compare algorithm versions

### Local storage recommendation

Start with:

- SQLite for structured session/event tables
- MMKV only for light settings/cache flags

### Backend storage recommendation

Start simple:

- relational DB for users/devices/sessions/scores
- append-oriented event table for raw samples

If event volume becomes large:

- move heavy time-series workloads to a more specialized setup later

---

## 10. Initial database entities

These tables are enough for the first durable version.

### `users`

- `id`
- `created_at`
- `timezone`
- `baseline_started_at`

### `devices`

- `id`
- `user_id`
- `vendor`
- `model`
- `source_kind`
- `external_device_id`
- `created_at`
- `last_seen_at`

### `sessions`

- `id`
- `user_id`
- `device_id`
- `started_at`
- `ended_at`
- `status`
- `source`
- `sample_count`

### `raw_samples`

- `id`
- `session_id`
- `timestamp_ms`
- `signal_type`
- `numeric_value`
- `text_value`
- `bool_value`
- `unit`
- `sequence`
- `quality`
- `raw_hex`

### `derived_features`

- `id`
- `user_id`
- `session_id`
- `feature_type`
- `window_start`
- `window_end`
- `value`
- `unit`
- `algorithm_version`

### `scores`

- `id`
- `user_id`
- `score_type`
- `score_date`
- `value`
- `confidence`
- `algorithm_version`
- `inputs_summary_json`

---

## 11. Algorithm roadmap

Our scoring system should be built progressively.

### Step 1: robust signal handling

Before advanced scoring, we need:

- timestamp normalization
- dropout detection
- artifact detection
- low-confidence tagging
- smoothing where appropriate

Without this, downstream metrics will look precise but be wrong.

### Step 2: feature extraction

Initial feature families:

- HRV windows
- resting heart rate estimates
- heart-rate variability trends
- load/effort proxies
- sleep duration and timing candidates
- deviation from baseline

### Step 3: baseline system

Scores should not be purely absolute. They should be user-relative where helpful.

Possible baseline concepts:

- 7-day rolling baseline
- 21-day stabilized baseline
- sleep debt history
- day-over-day variability

### Step 4: explainable scoring

Every score should have reasons attached.

Example:

- readiness lower because sleep was short and HRV trended down
- strain target lower because recovery confidence is moderate

### Step 5: calibration and versioning

We need to compare model outputs over time.

Store:

- algorithm version
- feature set version
- source coverage level
- confidence level

This allows:

- A/B comparison
- score backfills
- safe upgrades

---

## 12. Live product experiences to build

### Live session screen

Purpose:

- show that the device is connected and streaming

Should include:

- connection status
- live heart rate
- packet/sample count
- device battery if available
- session duration
- signal quality state

### Recovery dashboard

Purpose:

- daily understanding, not just live telemetry

Should include:

- readiness/recovery score
- supporting metrics
- comparison to baseline
- trend vs prior days
- explanation text

### Device screen

Purpose:

- reduce pairing and data-quality confusion

Should include:

- paired devices
- current source type
- permissions state
- last sync/live session
- troubleshooting

---

## 13. Engineering principles

### Preserve raw data

Do not throw away useful device payloads just because early UI does not use them.

### Keep parsing separate from scoring

Protocol logic and scoring logic should remain independent packages.

### Make quality visible

If signal quality is weak, the app should know and show it.

### Design for replay

Recorded sessions should be replayable through new parser/feature versions.

### Avoid hardware lock-in

One device may help us start, but the architecture should support more than one.

---

## 14. Main risks

### Risk 1: limited live data exposure

The target wearable may not expose enough live signals over BLE for our full
ambition.

Mitigation:

- spike the real device early
- keep an adapter architecture
- preserve the option to support other devices later

### Risk 2: misleading confidence from partial signals

It is easy to overstate score quality when only a subset of useful signals is available.

Mitigation:

- attach confidence levels
- separate "measured" from "estimated"
- log source coverage

### Risk 3: mobile BLE complexity

Pairing, reconnects, background behavior, and permissions are often the hardest
parts of hardware apps.

Mitigation:

- prototype with narrow scope first
- build strong device-state UX
- keep debug logs and session exports

### Risk 4: early algorithm overfitting

Small datasets can produce confident but fragile scoring logic.

Mitigation:

- version everything
- keep raw data
- compare models on replayed historical sessions

---

## 15. Near-term execution plan

This is the order that gives us the most signal with the least wasted work.

### Next 1: BLE source spike

Build:

- scan
- connect
- stream
- log
- local save

We should not expand the product surface much further until this works on a real device.

### Next 2: session recorder

Build:

- session lifecycle
- event persistence
- replay/debug tools

### Next 3: local metrics on recorded data

Build:

- simple derived metrics
- daily aggregation
- basic confidence states

### Next 4: backend ingest

Build:

- upload path
- event storage
- score history

### Next 5: algorithm iteration loop

Build:

- offline replay
- score comparison
- calibration tools

---

## 16. What "good" looks like

Recoup is on the right track when:

- we can connect to a real device reliably
- we can record and replay live sessions
- we store raw data safely
- our metrics come from our own pipeline
- our score explanations are understandable
- adding a second device source does not require rewriting the whole app

That is the standard this plan is aiming for.
