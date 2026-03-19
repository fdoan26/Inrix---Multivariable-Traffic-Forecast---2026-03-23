# Pitfalls Research

**Domain:** Traffic forecasting with INRIX API, TimescaleDB, Python ML, Mapbox frontend
**Researched:** 2026-03-19
**Confidence:** MEDIUM (training data only -- no web search available; well-established technologies increase baseline confidence)

## Critical Pitfalls

### Pitfall 1: Burning Through INRIX Trial Quota in Days

**What goes wrong:**
With 2000 calls/week and 1 RPS, naive data collection exhausts the quota immediately. A single segment poll every 5 minutes across 6 corridors (each corridor having 5-20 segments) burns 8,640-34,560 calls/day -- far exceeding the weekly cap. The project stalls with no data to train on.

**Why it happens:**
Developers think in terms of "poll each segment every N minutes" without doing the math against the trial cap. INRIX's paid tiers are generous, so most documentation examples assume higher limits. The trial key's restrictions are unusually tight.

**How to avoid:**
- Do the math first: 2000 calls/week = ~286/day = ~12/hour.
- Use INRIX's batch endpoints where available (e.g., segment speed for a bounding box returns multiple segments in one call).
- Poll the entire SF bounding box as a single API call rather than per-segment calls.
- Design a tiered polling schedule: peak hours (7-9 AM, 4-7 PM) every 15 min, off-peak every 60 min, overnight skip entirely.
- Cache aggressively -- INRIX speed data has a TTL concept; never re-fetch within that window.
- Store INRIX's built-in historical averages (which come free with speed responses) to reduce the need for historical polling.

**Warning signs:**
- HTTP 429 responses or quota exhaustion errors within the first day of testing.
- Collection scripts that make one call per road segment.
- No call counter or budget tracker in the data collection service.

**Phase to address:**
Phase 1 (Data Pipeline). The very first thing built must include a call budget manager. Design the entire collection strategy around 2000 calls/week before writing any code.

---

### Pitfall 2: Data Leakage in Time-Series Train/Test Splits

**What goes wrong:**
Standard random train/test splits leak future information into the training set. The model appears to have 95%+ accuracy during evaluation but fails catastrophically in production because it was trained on data that chronologically follows the test period.

**Why it happens:**
Scikit-learn's `train_test_split` defaults to random splitting. Most ML tutorials demonstrate random splits. Time-series requires strictly chronological splits where all training data precedes all validation data, and all validation data precedes all test data.

**How to avoid:**
- Always use `TimeSeriesSplit` from scikit-learn or manual chronological cutoffs.
- Train on weeks 1-N, validate on week N+1, test on week N+2. Never shuffle.
- Features derived from rolling windows must only use backward-looking data at each timestamp.
- If using lag features (e.g., "speed 1 hour ago"), ensure no future lag values leak into training rows.
- Walk-forward validation: retrain on expanding windows to simulate real deployment.

**Warning signs:**
- Suspiciously high accuracy (R-squared > 0.95) on initial model evaluation.
- Model performs dramatically worse on the first day of live deployment versus offline metrics.
- Using `sklearn.model_selection.train_test_split` with `shuffle=True` (the default) on timestamped data.

**Phase to address:**
Phase 3 (ML Model). Must be established as an iron rule before any model training begins. Build the evaluation harness (walk-forward split) before building the model.

---

### Pitfall 3: Treating Traffic as Stationary Time Series

**What goes wrong:**
The model learns weekly/daily seasonality patterns but fails to account for regime changes: new construction zones, pandemic recovery shifts, new transit routes, school calendar shifts, or gradually worsening congestion over months. Predictions drift and become stale.

**Why it happens:**
Classical time-series approaches (ARIMA, simple baselines) assume the underlying distribution is stationary or slowly drifting. SF traffic is non-stationary with multiple overlapping regimes (school year vs summer, pre- vs post-construction, event days).

**How to avoid:**
- Make the model explicitly aware of regime signals: `is_school_day`, `has_nearby_event`, `has_active_construction`, `is_rainy_forecast`.
- Use INRIX's historical baselines as an anchor but apply modifiers on top, not as ground truth.
- Implement model staleness detection: compare rolling prediction error against a threshold and trigger retraining.
- Log actual vs. predicted continuously from day one -- this is both a product feature AND the model health monitor.

**Warning signs:**
- Model accuracy degrades steadily over weeks after deployment.
- Predictions are consistently biased in one direction (always too fast or too slow) for specific corridors.
- The model cannot distinguish between a normal Tuesday and a Giants game Tuesday.

**Phase to address:**
Phase 2 (Feature Engineering) for signal design, Phase 3 (ML Model) for staleness detection, Phase 5 (Validation) for actual-vs-predicted tracking.

---

### Pitfall 4: Confidence Intervals That Are Meaningless

**What goes wrong:**
The project promises confidence intervals ("32-44 min, most likely 36") but implements them as +/- a fixed percentage or a single standard deviation of historical variance. These intervals are either too wide to be useful (user ignores them) or too narrow to be honest (user loses trust when actuals fall outside).

**Why it happens:**
Proper prediction intervals are harder than point predictions. Bootstrap methods require careful implementation. Many tutorials show symmetric intervals that don't match real traffic distributions (traffic delay is right-skewed -- there's a floor but no ceiling).

**How to avoid:**
- Use quantile regression (predict the 10th, 50th, and 90th percentiles directly) rather than mean +/- std.
- Or use conformal prediction: calibrate intervals on a held-out calibration set so they have guaranteed coverage.
- Traffic distributions are asymmetric: model them as such. The "best case" is close to free-flow; the "worst case" can be arbitrarily bad.
- Validate interval calibration: if you claim 80% intervals, check that 80% of actuals fall within them on test data.

**Warning signs:**
- Intervals that are the same width regardless of time of day (rush hour should be wider than 3 AM).
- Intervals that never contain the actual observed value during validation.
- Using `mean +/- 1.96 * std` as if travel times are normally distributed.

**Phase to address:**
Phase 3 (ML Model) for implementation. Phase 5 (Validation) for calibration checking. This is a core differentiator -- if intervals are bad, the product has no edge.

---

### Pitfall 5: TimescaleDB Hypertable Chunk Interval Mismatch

**What goes wrong:**
TimescaleDB partitions hypertables into chunks by time interval. If the chunk interval is too small (e.g., 1 hour) for infrequent data, you get millions of tiny chunks that slow down queries and bloat metadata. If too large (e.g., 1 month) for frequent data, individual chunks become too big for efficient operations like compression and deletion.

**Why it happens:**
Developers use the default chunk interval (7 days) without considering their actual data ingestion rate. With INRIX trial limits (~286 rows/day), 7 days is probably fine, but if the project scales to paid INRIX tiers with per-minute polling across hundreds of segments, the optimal interval changes dramatically.

**How to avoid:**
- Calculate: each chunk should contain roughly 25% of available memory for optimal performance (TimescaleDB docs recommendation).
- For the trial tier (~286 rows/day, small row size): 7-day or even 30-day chunks are fine.
- Set chunk interval explicitly at hypertable creation: `SELECT create_hypertable('traffic_readings', 'timestamp', chunk_time_interval => INTERVAL '7 days');`
- Plan for compression: enable TimescaleDB compression on chunks older than 1-2 weeks. This is critical for long-term storage on free-tier hosting.
- Add a retention policy early: `SELECT add_retention_policy('traffic_readings', INTERVAL '6 months');`

**Warning signs:**
- Queries that scan old data getting progressively slower.
- Disk usage growing faster than expected.
- `SELECT * FROM timescaledb_information.chunks` showing thousands of tiny chunks.

**Phase to address:**
Phase 1 (Data Pipeline / Database Setup). Get the schema right from the start. Changing chunk intervals on existing hypertables requires migration.

---

### Pitfall 6: Mapbox Token Exposed in Frontend Bundle

**What goes wrong:**
Mapbox GL JS requires a public access token. Developers embed the token directly in the JavaScript bundle without URL restrictions. Bots scrape the token and rack up Mapbox API usage against your account, potentially generating charges or hitting free-tier limits.

**Why it happens:**
Mapbox tokens must be client-side (the map renders in the browser). The "public" token feels safe because it is labeled "public." But without URL restrictions, anyone can use it from any domain.

**How to avoid:**
- Create a separate public token in Mapbox Studio with URL restrictions set to your production domain(s) and localhost for development.
- Never use your default secret token in the frontend.
- Set up Mapbox usage alerts to detect unexpected spikes.
- Use environment variables during build (e.g., `VITE_MAPBOX_TOKEN`) so the token is not hardcoded in source control, even though it will be in the built bundle.

**Warning signs:**
- Mapbox dashboard showing requests from unknown referrers.
- Usage spikes that don't correlate with your actual traffic.
- The same token used in both frontend (public) and backend (private) contexts.

**Phase to address:**
Phase 4 (Frontend). Set up restricted tokens from day one of map integration.

---

### Pitfall 7: Node.js Backend Becoming an Untestable Orchestration Monolith

**What goes wrong:**
The Express backend starts as a simple API proxy for INRIX, then accumulates: data collection cron jobs, ML microservice orchestration, event/weather enrichment logic, database queries, and caching. It becomes a tangled monolith where changing the data collection schedule risks breaking the API endpoints.

**Why it happens:**
Solo developer projects naturally centralize logic because "it's just one more endpoint." The Node backend is the easiest place to add each new feature. Separation into services feels like premature architecture for a demo.

**How to avoid:**
- Separate the data collection worker from the API server from day one, even if they share a codebase. Use separate entry points (`npm run serve` vs `npm run collect`).
- The data collector should be a standalone script/job that writes to the database. The API server reads from the database. They never share in-memory state.
- Keep the Python ML service truly separate: it reads from the database, writes predictions back. The Node server never calls Python directly in a request path.

**Warning signs:**
- Data collection failures causing API endpoint downtime.
- "I can't restart the server because it will miss the next collection cycle."
- ML predictions being computed synchronously inside Express request handlers.

**Phase to address:**
Phase 1 (Data Pipeline) for separation of concerns. Define clear process boundaries before writing code.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded SF corridor segment IDs | Skip INRIX segment discovery logic | Can't add new corridors without code changes | MVP only -- add config-driven segment lists in Phase 2 |
| Storing raw INRIX JSON blobs instead of normalized tables | Fast ingestion, no schema design | Query performance degrades, hard to join with weather/event data | Never -- normalize from the start, storage is cheap |
| Single Python script for all ML logic | Fast iteration | Retraining breaks prediction serving, no experiment tracking | MVP only -- split train vs. serve by Phase 3 end |
| Polling INRIX on a fixed interval regardless of time | Simple cron job | Wastes quota on low-value overnight polls | Only during initial testing; implement adaptive schedule within first week |
| Skipping database migrations (raw SQL changes) | Faster schema iteration | Cannot reproduce database state, team scaling impossible | First 2 weeks only; use migrations tooling before any production deploy |
| In-memory caching in Node.js | No Redis dependency | Cache lost on restart, no sharing between processes | MVP only -- acceptable if restarts are rare and cache rebuilds are cheap |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| INRIX API | Assuming segment IDs are stable forever | Segment IDs can change when INRIX updates their road network. Re-validate segment coverage monthly. Store by corridor + direction, not raw segment ID. |
| INRIX API | Ignoring the `score` field on speed data | INRIX returns a confidence score (0-30) indicating data quality. Score < 10 means the speed is estimated, not measured. Filter or flag low-score readings. |
| INRIX API | Not handling INRIX's XML default response format | INRIX defaults to XML. Always set `format=json` explicitly. Forgetting this causes parsing errors. |
| Open-Meteo | Treating forecast as ground truth | Weather forecasts degrade with horizon. Day 1-2 forecasts are good; day 6-7 are rough estimates. Weight the weather modifier by forecast confidence/horizon. |
| Open-Meteo | Not caching forecast responses | Open-Meteo updates forecasts every few hours. Fetching on every user request wastes bandwidth and adds latency. Cache forecasts with a 1-hour TTL. |
| Mapbox GL JS | Loading all road segments as individual GeoJSON features | Use a single GeoJSON source with all segments as a FeatureCollection, styled with data-driven expressions. Individual sources per segment causes massive overhead. |
| TimescaleDB | Running `INSERT` in a tight loop instead of batch inserts | Use `COPY` or multi-row `INSERT` for bulk data. Individual inserts have per-transaction overhead that compounds. |
| Python ML service | Calling the ML service synchronously from Express on each user request | Pre-compute forecasts on a schedule (e.g., every 30 min) and store results. The API serves pre-computed predictions, not live inference. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded time-range queries on TimescaleDB | API response times > 5s for "show me last month" | Always enforce max time range in API queries. Use continuous aggregates for pre-computed hourly/daily rollups. | When historical data exceeds ~3 months uncompressed |
| Rendering 100+ animated road segments on Mapbox simultaneously | Map frame rate drops below 15fps, mobile devices freeze | Use Mapbox's built-in data-driven styling with a single source layer, not per-segment animation loops. Update the data source, not individual features. | Above ~50 simultaneously updating segments |
| Python model loading on every prediction request | 2-5 second cold start per prediction | Load model once at service startup, serve from memory. Use a lightweight web server (FastAPI/Flask) that persists the model in process memory. | Immediately on first request |
| Frontend polling for real-time updates every second | Browser memory/CPU spike, INRIX quota burn via backend proxy | Use a 60-second poll interval minimum. Real-time traffic updates every 1-2 minutes are sufficient; sub-second is wasteful for traffic data that changes slowly. | Immediately with multiple browser tabs |
| Storing every INRIX response field | Database size balloons, queries slow from wide rows | Store only: timestamp, segment_id, speed, free_flow_speed, score, travel_time. Drop verbose metadata fields. | After ~2 months of collection |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| INRIX appId/hashToken in frontend code or git repo | Credential theft; attacker burns your trial quota or impersonates your account | Store in environment variables. Add `.env` to `.gitignore`. INRIX calls should only happen server-side. |
| Mapbox secret token used where public token should be | Secret token grants write access to your Mapbox account (style/tileset modification) | Use separate tokens: public (URL-restricted) for frontend, secret for any server-side Mapbox operations. |
| No rate limiting on your own API endpoints | Attacker can proxy through your API to exhaust INRIX quota | Add rate limiting middleware (e.g., `express-rate-limit`) to all endpoints, especially those that trigger INRIX calls. |
| Database connection string in source code | Full database access if repo is public or leaked | Use environment variables for all connection strings. Validate that `DATABASE_URL` is not committed. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing a loading spinner for 5+ seconds while ML prediction runs | Users abandon. Google Maps gives instant ETAs. | Pre-compute predictions. The user-facing query should be a database lookup, not a model inference call. Target < 500ms API response. |
| Displaying confidence intervals as raw numbers ("32-44 min") | Users don't know if that range is good or bad | Add visual context: color-code the range width (narrow = green/confident, wide = orange/uncertain). Show "high confidence" vs "rough estimate" labels. |
| Map defaults to zoomed-out view of entire SF | User has to zoom and pan to their corridor every time | Remember the user's last map view in localStorage. Or ask for a "home corridor" during onboarding. |
| Showing too many corridors at once with competing color scales | Visual overload; user can't find their route | Default to one corridor highlighted, others dimmed. Let user toggle corridors on/off. |
| "Best time to drive" showing times that have already passed | Useless recommendation at 10 AM that says "leave at 7 AM" | Filter recommendations to future times only. Show "the next best window is..." with clear temporal context. |
| No explanation of why a time is predicted as slow | User doesn't trust the prediction | Add brief annotations: "Slow due to: Warriors game + rain forecast" -- this is the product's key differentiator. |

## "Looks Done But Isn't" Checklist

- [ ] **Data collection:** Running and collecting, but not handling INRIX API errors/timeouts gracefully -- verify retry logic with exponential backoff and quota awareness.
- [ ] **ML predictions:** Model produces numbers, but confidence intervals are not calibrated -- verify with interval coverage test on held-out data (target: 80% coverage for 80% intervals).
- [ ] **Map visualization:** Road segments render, but colors don't update when new data arrives -- verify WebSocket/polling actually refreshes the map source data.
- [ ] **"Best time to drive":** Returns a time, but doesn't account for travel duration at that time -- verify the recommended departure time plus predicted travel time equals desired arrival time.
- [ ] **Event integration:** Giants game dates are loaded, but pre-game traffic (2 hours before) and post-game traffic (1 hour after) are not modeled -- verify the event impact window extends beyond the event start/end time.
- [ ] **Weather integration:** Rain is detected, but fog (SF's dominant weather pattern) is not treated as a separate signal -- verify fog/low-visibility is a distinct feature, not lumped with general precipitation.
- [ ] **Actual vs. predicted tracking:** Predictions are logged, but there's no mechanism to capture what actually happened at that time -- verify the system stores observed actuals alongside predictions for the same time window.
- [ ] **Database retention:** Data is being stored, but no compression or retention policy is active -- verify TimescaleDB compression is enabled and old data is being compressed on schedule.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| INRIX quota exhausted mid-week | LOW | Fall back to INRIX historical baselines (already cached). Resume collection next week. Implement budget tracker to prevent recurrence. |
| Data leakage discovered after model training | MEDIUM | Re-split data chronologically. Retrain. Compare metrics -- if they drop significantly, the model was relying on leakage. Redesign features. |
| TimescaleDB chunk interval wrong | MEDIUM | Create new hypertable with correct interval, migrate data with `INSERT INTO new_table SELECT * FROM old_table`, swap names. Downtime required. |
| Mapbox token scraped and abused | LOW | Revoke token in Mapbox Studio, create new restricted token, redeploy frontend. Takes < 30 minutes. |
| Node.js monolith too tangled to modify | HIGH | Extract data collection into standalone worker first (highest value separation). Then extract ML orchestration. Gradual refactor over 1-2 weeks. |
| Confidence intervals found to be uncalibrated in production | MEDIUM | Switch to conformal prediction (post-hoc calibration on recent data). Can be applied without retraining the point-prediction model. |
| Model drift detected after deployment | LOW | Retrain on most recent 4-6 weeks of data. If drift is from a regime change (new construction), add the signal as a feature. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| INRIX quota burn | Phase 1: Data Pipeline | Call counter shows < 2000/week; adaptive schedule implemented |
| Data leakage in train/test | Phase 3: ML Model | All splits are chronological; no future data in training set |
| Non-stationary time series | Phase 2: Feature Engineering | Event/weather/school features are explicitly modeled; actual-vs-predicted tracking live |
| Meaningless confidence intervals | Phase 3: ML Model + Phase 5: Validation | Interval coverage test passes (80% of actuals within 80% CI) |
| TimescaleDB chunk misconfiguration | Phase 1: Database Setup | Chunks verified with `timescaledb_information.chunks`; compression policy active |
| Mapbox token exposure | Phase 4: Frontend | Token has URL restrictions; separate tokens for dev/prod |
| Node.js monolith coupling | Phase 1: Data Pipeline | Data collector and API server are separate processes with separate entry points |
| Synchronous ML inference in API path | Phase 3: ML Model | Predictions are pre-computed on schedule; API serves from database |
| No explanation for predictions | Phase 4: Frontend | Each prediction shows contributing factors (weather, events, school) |
| Past-time recommendations shown | Phase 4: Frontend | "Best time to drive" only shows future departure windows |

## Sources

- INRIX IQ API documentation patterns (training data, MEDIUM confidence)
- TimescaleDB documentation on hypertables, compression, and continuous aggregates (training data, HIGH confidence -- well-established and stable)
- Scikit-learn documentation on TimeSeriesSplit and cross-validation (training data, HIGH confidence)
- Mapbox GL JS documentation on data-driven styling and source management (training data, HIGH confidence)
- General time-series ML best practices from forecasting literature (training data, MEDIUM confidence)
- Note: Web search was unavailable during this research session. All findings are from training data. Core patterns for TimescaleDB, scikit-learn, and Mapbox are well-established and unlikely to have changed. INRIX-specific details (exact API behavior, segment ID stability) should be verified against current INRIX IQ docs during Phase 1.

---
*Pitfalls research for: SF Traffic Forecaster -- INRIX + TimescaleDB + Python ML + Mapbox*
*Researched: 2026-03-19*
