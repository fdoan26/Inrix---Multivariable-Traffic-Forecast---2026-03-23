# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-23
**Phases:** 6 | **Plans:** 14 | **Sessions:** 1 (autonomous)

### What Was Built
- Complete INRIX + Open-Meteo + calendar data pipeline into TimescaleDB with budget enforcement
- Python ML forecasting service (baseline + XGBoost) with weather/event/school modifiers and p10/p50/p90 confidence intervals
- Express REST API with 5 endpoints, CORS, Zod validation, in-memory TTL cache
- React/Vite/Mapbox frontend — interactive SF map, live speed overlay, incident markers, departure planner, week-ahead heatmap
- Accuracy tracking pipeline — `forecast_outcomes` table, outcome logger CLI, `/api/accuracy` endpoint, AccuracyDashboard

### What Worked
- **TDD wave pattern (RED→GREEN)**: Writing test stubs in Wave 0 before implementation made every task verifiable and prevented stub code from shipping. No production code shipped without a failing test first.
- **Autonomous pipeline (discuss→plan→execute)**: All 6 phases ran without manual intervention after initial setup. The GSD skill chain handled context accumulation and phase transitions cleanly.
- **Zod for all API boundaries**: Consistent use of Zod in both backend (query params, response parsing) and frontend (form validation) caught type mismatches early in tests rather than at runtime.
- **Per-phase CONTEXT.md**: Having explicit implementation decisions locked before planning meant planners didn't need to ask during execution. Decision density was high and questions were rare.
- **Express 5 async propagation**: Eliminated try/catch boilerplate in route handlers — errors propagate to the centralized error middleware automatically.

### What Was Inefficient
- **Phase 2 tracking staleness**: ROADMAP.md Phase 2 checkboxes were never updated during execution (showed "1/3 plans executed" through Phase 6). Planning tools should auto-update checklist state on plan completion.
- **TMC_PLACEHOLDER segment IDs**: Phase 2 shipped with placeholder segment IDs because Phase 1 data hadn't accumulated. This made the ML pipeline produce non-real forecasts for the entire milestone. The gap was known but could have been front-loaded with a "minimum data accumulation" gate before Phase 2 was declared ready.
- **`import.meta.url` in CommonJS**: The backend's CommonJS module system (not ESM) caused a fix commit in Phase 6 for the outcome-logger CLI entry point. The `"type": "commonjs"` in `backend/package.json` should have been a checklist item in the researcher prompt for any CLI script.
- **`INCIDENT_TYPE_MAP` created but not connected**: An abstraction was exported in `types/api.ts` but not wired to its consumers (`IncidentMarker`, `IncidentPopup`). Unused exports should be caught during the phase verifier pass.

### Patterns Established
- **Batch SQL with CROSS JOIN LATERAL**: For the outcome logger, a single batch INSERT...SELECT avoids N+1 queries and keeps the script idempotent via ON CONFLICT. This pattern is reusable for any "compare predicted vs actual" pipeline.
- **`p50/p10` ratio for congestion level**: Backend and frontend share the same thresholds (≤1.2 free_flow, ≤1.5 moderate, >1.5 heavy). This must be kept in sync — the heatmap's `congestion.ts` was explicitly written to match the backend's `deriveCongestionRisk`. Any future changes require updating both.
- **`enabled` flag in TanStack Query**: Conditional data fetching (only when a corridor is selected, only when a form is submitted) keeps the network request count low and avoids waterfall rendering. Use `enabled: !!someId` as the standard pattern for dependent queries.
- **Zod v4 `.issues` not `.errors`**: Zod v4 is a breaking change from v3. The `.errors` array became `.issues`. Document this at the project level so future developers don't hit it.

### Key Lessons
1. **Data dependency gates matter**: The ML pipeline was blocked by real INRIX segment IDs until Phase 1 data accumulated. For data-dependent phases, explicitly plan a "wait for data" check before committing to placeholder behavior as the Phase 2 output.
2. **Operational wiring is a deliverable**: The outcome logger CLI exists but has no cron entry in `worker.ts`. The distinction between "implemented" and "wired into the running system" is important — if a feature requires a manual step to activate, that step should be part of the phase plan's success criteria.
3. **CommonJS vs ESM is a latent footgun**: Express/Node backends that use CommonJS (`"type": "commonjs"`) silently break `import.meta.url` patterns. Any new CLI script must check module system before using ESM-only globals.
4. **Phase verifier should flag unused exports**: `INCIDENT_TYPE_MAP` shipped as an orphaned export. The gsd-verifier's anti-pattern check should include "exported but never imported in any other file."

### Cost Observations
- Model mix: ~100% sonnet (claude-sonnet-4-6), via GSD quality profile
- Sessions: 1 autonomous session (context compacted once mid-milestone)
- Notable: 6 phases + 14 plans + ~281 tests in a single autonomous run; context window management via compaction was transparent

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 MVP | 1 | 6 | First milestone; established TDD wave pattern and autonomous discuss→plan→execute pipeline |

### Cumulative Quality

| Milestone | Tests | Phases | Zero-Dep Additions |
|-----------|-------|--------|--------------------|
| v1.0 MVP | ~281 | 6 | 0 (all dependencies justified by requirements) |

### Top Lessons (Verified Across Milestones)

1. **TDD RED→GREEN per task** — Test stubs before implementation (Wave 0) is the single biggest quality multiplier. Every deviation from this led to a gap finding.
2. **Lock decisions in CONTEXT.md before planning** — Ambiguity during execution is expensive; decisions locked before the planner runs are free.
