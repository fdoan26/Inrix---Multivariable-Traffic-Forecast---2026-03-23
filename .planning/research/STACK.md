# Stack Research

**Domain:** Real-time + predictive traffic forecasting web application
**Researched:** 2026-03-19
**Confidence:** HIGH (all versions verified via npm/pip registries)

## Recommended Stack

### Backend (Node.js API + Data Collection)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 24.x LTS | Runtime | Current LTS. Async I/O ideal for API orchestration (INRIX polling, weather fetching, serving requests). Solo dev benefits from one language across backend/frontend. |
| Express | 5.2.1 | HTTP framework | Express 5 is now stable. Mature ecosystem, minimal abstraction, sufficient for an API gateway that proxies ML predictions and serves time-series data. No need for heavier frameworks when routes are straightforward. |
| TypeScript | 5.9.x | Type safety | Catches INRIX/Open-Meteo response shape mismatches at compile time. Critical when dealing with external APIs whose shapes you do not control. |
| pg (node-postgres) | 8.20.x | PostgreSQL driver | Direct driver, not an ORM. TimescaleDB hypertable queries (time_bucket, continuous aggregates) are SQL-native -- an ORM would fight you. Raw parameterized queries give full control. |
| node-cron | 4.2.x | Job scheduling | Lightweight in-process cron for INRIX data collection jobs (every 15 min) and weather forecast refresh (every 6 hours). Simpler than external job queues for a solo-dev project. |
| axios | 1.13.x | HTTP client | Interceptors for INRIX auth token refresh, automatic retry with exponential backoff. Better ergonomics than native fetch for the retry/timeout patterns INRIX rate limits demand. |
| zod | 4.3.x | Schema validation | Validate INRIX and Open-Meteo response shapes at runtime. Catches API contract changes before they corrupt your database. Generates TypeScript types as a bonus. |

### Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL | 16 | Primary database | Mature, free, excellent JSON support for semi-structured event data. Runs on Railway/Render free tiers. |
| TimescaleDB | 2.x (extension) | Time-series optimization | Hypertables give automatic time-based partitioning for INRIX speed readings. `time_bucket()` aggregation is exactly what "average speed for segment X at hour Y on day-of-week Z" needs. Continuous aggregates pre-compute hourly/daily rollups without custom ETL. |

**Why not a dedicated time-series DB (InfluxDB, QuestDB)?** PostgreSQL + TimescaleDB keeps everything in one database -- segment metadata, event calendars, user preferences, AND time-series readings. No need to operate two databases as a solo dev. TimescaleDB's SQL interface means the Node backend and Python ML service both speak the same query language.

### ML Microservice (Python)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.12 | Runtime | Stable, wide ML library support. 3.12 has significant performance improvements over 3.11. Avoid 3.13 in production -- too new for library compatibility guarantees. |
| FastAPI | 0.135.x | HTTP framework | Async, auto-generates OpenAPI docs, Pydantic validation built in. The Node backend calls this service via HTTP -- auto-docs make the contract self-documenting. Flask is the legacy choice; FastAPI is the modern standard. |
| uvicorn | 0.42.x | ASGI server | Production server for FastAPI. Lightweight, fast, handles the low concurrency this service will see (Node backend is the only client). |
| XGBoost | 3.2.x | Gradient boosting | Best out-of-the-box performer for tabular time-series features (day-of-week, hour, weather, events). Beats linear models significantly, trains in seconds on the data volumes here (~2000 INRIX calls/week). No need for deep learning -- the feature engineering matters more than model complexity at this scale. |
| scikit-learn | 1.8.x | ML utilities | Preprocessing (StandardScaler, OneHotEncoder), train/test split, cross-validation, metrics. The glue around XGBoost. |
| pandas | 3.0.x | Data manipulation | Feature engineering pipeline: merge INRIX readings with weather forecasts and event calendars by timestamp. The standard for tabular data wrangling in Python. |
| numpy | 2.4.x | Numerical computing | Underlying array operations for pandas/scikit-learn/XGBoost. Required dependency. |

### Frontend

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.x | UI framework | Component model suits this app well (map panel, forecast chart, corridor selector are natural components). React 19 is stable with improved server components, though this app is fully client-rendered. |
| Vite | 8.x | Build tool | Fast HMR, native ESM. Create React App is dead. Vite is the uncontested default for new React projects. |
| TypeScript | 5.9.x | Type safety | Shared types between API responses and frontend state. Prevents "the API changed and the UI silently broke" class of bugs. |
| Mapbox GL JS | 3.20.x | Map rendering | WebGL-powered, vector tile maps with smooth zoom/pan. Free tier: 50K map loads/month -- more than enough for dev and early users. The project spec calls for Mapbox specifically. |
| react-map-gl | 8.1.x | React wrapper for Mapbox | Declarative `<Map>`, `<Source>`, `<Layer>` components. Maintained by Vis.gl (Uber's open-source team). Avoids imperative Mapbox GL API calls in React lifecycle. |
| Recharts | 3.8.x | Charting | Confidence interval charts (area charts with bands), hourly speed line charts, week-ahead forecast visualization. React-native component API. Simpler than D3 for the chart types this app needs. |
| Zustand | 5.x | State management | Lightweight store for selected corridor, forecast time range, active layers. No boilerplate. Redux is overkill for an app with 3-4 pieces of global state. |
| TanStack Query | 5.91.x | Server state | Caching, deduplication, stale-while-revalidate for INRIX speed data and forecast API calls. Handles the "refetch every 5 min" pattern that real-time traffic data needs. |
| date-fns | 4.1.x | Date utilities | Format timestamps, calculate "departure window" ranges, day-of-week logic. Tree-shakeable (unlike moment.js). |

### Infrastructure

| Technology | Purpose | Why Recommended |
|------------|---------|-----------------|
| Railway or Render | Backend hosting | Free tier for Node + PostgreSQL. Railway has native TimescaleDB template. Render has persistent disks for the same. Either works; Railway's DX is slightly better for database add-ons. |
| Vercel | Frontend hosting | Free tier, automatic deploys from Git, edge CDN. The default for React/Vite apps. |
| Docker Compose | Local development | Run PostgreSQL+TimescaleDB and the Python ML service locally with one command. Eliminates "works on my machine" for the polyglot stack. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint + Prettier | Linting/formatting (JS/TS) | Use flat config (eslint.config.js). Enforces consistency in a solo project where "I'll fix it later" never happens. |
| Ruff | Linting/formatting (Python) | Replaces flake8 + black + isort. Single tool, extremely fast. The new standard for Python projects. |
| Vitest | Frontend testing | Native Vite integration, Jest-compatible API. Test forecast display logic and API response parsing. |
| pytest | Python testing | Test feature engineering pipeline and model prediction endpoints. |

## Installation

```bash
# Node.js backend
npm init -y
npm install express pg axios node-cron zod dotenv cors
npm install -D typescript @types/express @types/node @types/cors vitest eslint prettier

# React frontend
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install mapbox-gl react-map-gl recharts zustand @tanstack/react-query date-fns
npm install -D @types/mapbox-gl

# Python ML service
python -m venv .venv
pip install fastapi uvicorn[standard] xgboost scikit-learn pandas numpy psycopg2-binary
pip install -D pytest ruff

# Local infrastructure
# docker-compose.yml with timescale/timescaledb:latest-pg16 image
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Express 5 | Fastify | If you need maximum JSON serialization throughput. Express is fine for the request volumes here (<100 RPM). |
| pg (raw SQL) | Prisma / Drizzle ORM | If the app had complex relational queries across many tables. ORMs fight TimescaleDB-specific SQL (time_bucket, continuous aggregates). Raw SQL wins here. |
| XGBoost | LightGBM | If training data were 10x larger. LightGBM is faster on huge datasets. At ~2000 readings/week accumulating over months, XGBoost is sufficient and has better documentation. |
| XGBoost | Prophet / NeuralProphet | If you wanted automatic seasonality decomposition without manual feature engineering. But Prophet's "black box" approach makes it harder to layer in event/weather modifiers explicitly, which is the core value proposition. |
| XGBoost | LSTM / Transformer | If you had millions of data points and needed to capture long-range temporal dependencies. Massive overkill for this data volume. Would take longer to train, harder to debug, and unlikely to outperform XGBoost with good features. |
| Zustand | Redux Toolkit | If the app grew to 20+ pieces of interconnected state. For 3-4 slices of state, Redux is ceremony without benefit. |
| Recharts | D3.js | If you needed highly custom, non-standard visualizations. Recharts covers confidence interval bands, line charts, and area charts -- everything this app needs -- with 90% less code. |
| Recharts | Nivo | Nivo is also React-based and has nice time-series support. Recharts has a larger community and more examples for the specific chart types needed. |
| FastAPI | Flask | If you needed maximum simplicity for a single endpoint. FastAPI's auto-docs and Pydantic validation justify the marginal complexity increase. Flask is the legacy default; FastAPI is the modern one. |
| react-map-gl | deck.gl | If you needed 3D data visualization on maps (e.g., extruded traffic volume columns). react-map-gl is sufficient for 2D segment coloring and marker overlays. |
| Railway | Fly.io | If you needed multi-region deployment or persistent Docker containers with more control. Railway's simplicity wins for solo dev. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Create React App (CRA) | Deprecated, unmaintained since 2023. Webpack-based, slow. | Vite |
| Moment.js | Huge bundle (300KB+), mutable API, deprecated by its own authors. | date-fns |
| InfluxDB / QuestDB | Adds a second database to operate. You still need PostgreSQL for relational data (events, corridors, users). | TimescaleDB extension on PostgreSQL |
| Sequelize / TypeORM | ORMs that generate SQL cannot express TimescaleDB-specific functions (time_bucket, continuous aggregates). You will fight the ORM constantly. | Raw pg queries with parameterized SQL |
| TensorFlow / PyTorch | Deep learning frameworks are massive overkill for tabular prediction with <100K rows. Slower to train, harder to deploy, no accuracy benefit at this scale. | XGBoost |
| Prophet | Designed for business metrics forecasting (revenue, pageviews). Poor at incorporating external features like weather and events as first-class signals. Its additive model is too rigid for traffic pattern complexity. | XGBoost with manual feature engineering |
| Socket.io for real-time | INRIX data updates at most every 5 minutes. Polling via TanStack Query's refetchInterval is simpler and sufficient. WebSockets add complexity without benefit when data freshness is measured in minutes, not seconds. | TanStack Query with refetchInterval |
| Next.js | SSR/SSG adds complexity this app does not need. The map is entirely client-rendered, the data is user-specific (selected corridor + time range). A static SPA served from Vercel CDN with API calls to the backend is the right architecture. | Vite + React SPA |
| MongoDB | Document store is wrong for time-series range queries and relational event data. No equivalent to TimescaleDB's time_bucket aggregation. | PostgreSQL + TimescaleDB |

## Stack Patterns

**For the INRIX data collection layer:**
- Use node-cron to poll every 15 minutes (fits within 2000 calls/week budget: 96 calls/day x 7 = 672/week, leaving headroom for on-demand queries)
- Use axios with retry interceptor (INRIX returns 429 on rate limit)
- Use zod to validate INRIX response before database insert (catch API contract changes early)

**For the ML prediction pipeline:**
- Node backend calls Python FastAPI service via HTTP, not subprocess spawn
- FastAPI loads trained model once at startup (not per-request)
- Model retraining runs as a scheduled job (weekly), not triggered per-request
- Prediction endpoint accepts: segment_id, target_datetime, weather_forecast, event_flags
- Returns: predicted_speed, confidence_low, confidence_high

**For the frontend map rendering:**
- Use react-map-gl `<Source type="geojson">` with `<Layer type="line">` for segment coloring
- Color segments by congestion level (green/yellow/red) using data-driven styling
- Use Recharts `<AreaChart>` with two Area components for confidence interval bands
- TanStack Query `refetchInterval: 300000` (5 min) for live speed data

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-map-gl@8.x | mapbox-gl@3.x | react-map-gl 8 was built for mapbox-gl v3. Do not use mapbox-gl v2 with react-map-gl 8. |
| pg@8.x | PostgreSQL 16 + TimescaleDB 2.x | node-postgres is version-agnostic to PG server version. TimescaleDB queries are just SQL. |
| XGBoost@3.x | scikit-learn@1.8.x | XGBoost 3.x implements scikit-learn estimator API. Compatible with sklearn pipelines. |
| pandas@3.0.x | numpy@2.4.x | pandas 3.0 requires numpy 2.x. Do not pin numpy to 1.x. |
| TanStack Query@5.x | React@19.x | Fully compatible. Uses React 18+ concurrent features. |
| Vite@8.x | React@19.x | Use @vitejs/plugin-react. |

## Sources

- npm registry (npm view [package] version) -- all JavaScript/TypeScript versions verified 2026-03-19
- PyPI (pip index versions [package]) -- all Python versions verified 2026-03-19
- nodejs.org -- Node.js 24 LTS confirmed as current LTS (verified via WebFetch 2026-03-19)
- Project constraints from .planning/PROJECT.md -- INRIX rate limits, budget, solo dev

---
*Stack research for: SF Traffic Forecaster*
*Researched: 2026-03-19*
