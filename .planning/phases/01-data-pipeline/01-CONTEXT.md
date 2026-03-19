# Phase 1: Data Pipeline - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers all external data sources flowing into TimescaleDB on a scheduled basis, within INRIX's 2000 calls/week trial limit. Outputs: speed readings for all SF bounding-box segments, incidents, Open-Meteo weather forecasts, SFUSD school calendar flags, and local event flags. This phase produces no user-facing UI — it is the data foundation everything else depends on.

</domain>

<decisions>
## Implementation Decisions

### INRIX Collection Strategy
- Use bounding-box endpoint (one call returns all SF segments) — preserves quota vs per-segment polling
- Collect segment speeds every 15 minutes (~672 calls/week for speeds, leaves ~1,328 calls headroom)
- Collect incidents every 30 minutes — incidents change slowly, saves ~336 calls/week vs matching speed frequency
- Hard stop at 80% of weekly budget (1,600 calls) — budget tracker runs before each job, aborts if limit reached

### Database Schema
- TimescaleDB chunk interval: 1 day — matches daily traffic patterns, compresses well
- Store all segments in SF bounding box — maximizes data for model training; filtering to 6 corridors loses training data
- Separate hypertable for forecasts — queryable and indexable vs JSONB column
- Primary index: composite (segment_id, timestamp) — efficient range queries per segment

### Scheduler Architecture
- node-cron for scheduling — simple, no Redis dependency appropriate for solo project scope
- Retry with exponential backoff (3 attempts) — handles INRIX transient failures
- Console + DB log table for job logging — enables budget tracking and post-hoc debugging
- Separate worker process for data collection — decoupled from API server so restarts don't kill active collection jobs

### External Signals Integration
- School calendar: manual CSV seeded from SFUSD published calendar — reliable, no scraping fragility
- Events: manual seed file for Giants/Warriors schedules + major concerts — public schedules, no third-party API dependency for MVP
- Weather: fetch from Open-Meteo daily at midnight — 7-day forecast is stable, one daily fetch is sufficient
- Signal storage: date-keyed flags table (columns: date, school_day BOOLEAN, event_name TEXT, event_type TEXT) — simple structure with fast date joins

### Claude's Discretion
- Specific TimescaleDB hypertable compression policy settings
- Exact DB table column names and types (beyond the agreed structure)
- node-cron cron expression syntax for 15/30 min intervals
- Backoff timing (e.g., 1s → 5s → 30s)
- Error alerting format in DB log table

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None established yet — this phase sets the patterns for the project

### Integration Points
- Phase 2 (Forecasting Model) reads from the segment speeds hypertable and calendar flags table
- Phase 3 (API Layer) reads from forecasts hypertable and live speeds
- Worker process must expose a health check or status endpoint for Phase 3 API to report collection status

</code_context>

<specifics>
## Specific Ideas

- INRIX SF bounding box: 37.858,-122.541 → 37.699,-122.341 (from PROJECT.md)
- INRIX auth: appId + hashToken (trial credentials in hand)
- INRIX rate limit: 1 RPS, 2000 calls/week
- Open-Meteo endpoint: free, no API key, 7-day hourly forecast for SF coordinates
- Target corridors for forecast display: 101, 280, Bay Bridge approach, Van Ness, 19th Ave, Market St

</specifics>

<deferred>
## Deferred Ideas

- Automated event scraping (Ticketmaster/SeatGeek API) — manual seeding sufficient for MVP, automation is v2
- SFUSD iCal subscription — manual CSV is more reliable for MVP timeframe
- Multi-city expansion — out of scope per PROJECT.md (INRIX trial geo-locked to SF)

</deferred>
