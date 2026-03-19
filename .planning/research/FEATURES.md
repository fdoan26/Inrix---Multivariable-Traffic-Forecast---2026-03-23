# Feature Research

**Domain:** Traffic forecasting / week-ahead departure planning (SF-specific)
**Researched:** 2026-03-19
**Confidence:** MEDIUM (based on training data knowledge of traffic apps, INRIX API capabilities, and competitive landscape; no live web search verification available)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Interactive map with traffic overlay | Every traffic app (Google Maps, Waze, Apple Maps) shows a color-coded speed map. Users orient around a map. Without it the product feels like a spreadsheet. | MEDIUM | Mapbox GL JS with GeoJSON line layers colored by speed/congestion level. INRIX segments mapped onto map lines. |
| Origin-destination route input | Users think in terms of "home to work," not "segment 1234." An O/D input is the minimum interaction model. | MEDIUM | Mapbox Directions API or geocoding + snap to INRIX corridors. Can simplify to corridor picker for MVP. |
| Current traffic conditions display | Users will check current conditions to calibrate trust before relying on forecasts. Without "what's happening now," they can't validate. | LOW | Direct INRIX speed data call, compare to free-flow. Color-coded segments. |
| Travel time estimate for a route | The baseline output of any traffic tool. Users need a number: "It will take X minutes." | LOW | Sum segment travel times from INRIX route API or segment speeds + distances. |
| Mobile-responsive web layout | SF commuters check traffic on phones. A desktop-only tool misses the primary use context. | MEDIUM | Responsive CSS, touch-friendly controls. Not a native app, but must work well in mobile Safari/Chrome. |
| Incident/event alerts on map | Users expect to see crashes, construction, road closures. INRIX provides this data. Omitting it feels like a gap. | LOW | INRIX incidents API overlay on map with icons and popups. |
| Day/time selector for future lookup | Users must be able to ask "What will traffic look like Tuesday at 5pm?" This is the minimum forecast interaction. | LOW | Date/time picker that queries forecast model for the selected window. |

### Differentiators (Competitive Advantage)

Features that set the product apart from Google Maps, Waze, and Apple Maps. These align with the core value proposition of week-ahead planning with uncertainty quantification.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Week-ahead corridor forecast view | Google/Apple only forecast 0-2 hours. Showing congestion predictions for the full week ahead is the primary differentiator. Users can plan around bad days. | HIGH | Requires the forecasting model (baseline + weather + events + school calendar). Display as a heatmap grid: corridors x time slots over 7 days. |
| Confidence intervals on travel times | No consumer app shows uncertainty. "32-44 min (most likely 36)" is dramatically more honest and useful than a single number that's often wrong. | MEDIUM | Bootstrap from historical variance per day/hour/corridor. Display as range bar or fan chart. |
| "Best departure time" recommender | Given O/D and desired arrival, recommend optimal departure window across the week. The core planning use case. "Leave at 7:10am Tuesday or 7:40am Thursday for the best commute this week." | HIGH | Requires forecast model + optimization over time windows. Rank departure slots by predicted travel time and confidence width. |
| Weather-adjusted forecasts | Google sees rain effects only after they happen (via probe speed drops). This tool uses Open-Meteo 7-day forecast to predict rain/fog slowdowns before they materialize. | MEDIUM | Weather modifier coefficients applied to baseline forecasts. Rain adds 10-25% to travel times on SF surface streets depending on severity; fog affects 19th Ave/Sunset corridors specifically. |
| Event-aware predictions | Giants/Warriors games, Outside Lands, etc. create massive localized congestion that baseline models miss. Flagging these as anomaly days gives users advance warning. | MEDIUM | Scrape/maintain a calendar of major SF events. Apply congestion multipliers to affected corridors during pre-game/post-game windows. |
| School calendar integration | SFUSD school days shift morning rush timing and intensity. Summer break, holidays, and teacher workdays all reduce morning congestion. Subtle but measurable signal. | LOW | Binary school-day flag in forecast model. SFUSD publishes annual calendars. |
| Forecast accuracy tracking dashboard | Show users how accurate past predictions were. "Last week our forecasts were within 3 minutes 82% of the time." Builds trust and demonstrates value over Google Maps. | MEDIUM | Log predictions vs actuals. Compute and display MAPE, coverage of confidence intervals. Requires data collection pipeline running for at least 1-2 weeks before meaningful. |
| Week planner / calendar view | A grid showing all 7 days with congestion severity for each corridor by time-of-day. At a glance: "Wednesday afternoon looks terrible, Thursday is clear." | MEDIUM | Heatmap visualization. Rows = corridors, columns = time slots, color = predicted congestion severity. This IS the product's signature view. |
| Congestion risk score | A single number (e.g., 1-10) summarizing how bad a given departure time is likely to be. Easier to grasp than raw minutes for quick decisions. | LOW | Composite of predicted delay, confidence interval width, and event flags. Simple to compute once forecast model exists. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems, especially for a solo dev with constrained API budget.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time turn-by-turn navigation | Users expect it because Google Maps has it. | Massive scope explosion. Requires continuous GPS tracking, real-time rerouting, voice guidance, mobile-native features. Completely different product. Also competes directly with Google/Waze where they are strongest. | Stay in the planning lane. "We tell you when to leave, Google tells you how to get there." Link out to Google Maps for navigation. |
| Live Google Maps ETA comparison | Users want to see "we predicted 36 min, Google says 42 min." | Against Google Maps ToS to programmatically scrape/display their ETAs. Legal risk for zero benefit. | Manual benchmarking for marketing claims. Show own accuracy tracking instead. |
| Multi-city support | Obvious feature request once the concept works. | INRIX trial key is geo-locked to SF bounding box. Multi-city requires paid INRIX contract ($$$), city-specific event/school calendars, and per-city model tuning. Premature scaling. | Build for SF only. If it works, multi-city is a funding milestone, not a feature. |
| Real-time push notifications ("leave now!") | Users want to be told when to leave without checking the app. | Requires push notification infrastructure (service workers, notification permissions, background jobs monitoring departure windows). High complexity for a web app. Also requires knowing user's schedule, which is a data collection/privacy concern. | Email digest ("your week ahead") is simpler. Or just make the app fast to check. Notifications are v2+ if usage warrants. |
| Crowd-sourced reports (Waze model) | User reports of accidents, police, hazards seem valuable. | Requires critical mass of users to be useful. With 0 users at launch, this feature is dead weight. Also requires moderation, spam prevention, and trust scoring. | Rely on INRIX incidents data (which already aggregates from multiple sources including Waze). |
| Historical deep-dive analytics | "Show me traffic on this corridor every Tuesday for the past 6 months." | Interesting for data nerds but not the core use case. Requires massive historical data storage and complex query UI. Distracts from the forward-looking planner value prop. | Show 4-week rolling trend at most. Historical data powers the model, not the user interface. |
| Native mobile app | Users prefer native apps for frequent-use tools. | Solo dev, 4-6 week timeline. Building iOS + Android (or even React Native) doubles frontend effort. App store review adds weeks. | Mobile-responsive PWA. Add to home screen prompt. Revisit native only if daily active users justify it. |
| Personalized route learning | "Learn my commute patterns and auto-predict." | Requires user accounts, route history storage, ML per-user model. Privacy implications. Way too complex for MVP. | Let users bookmark 2-3 corridors. Personalization is localStorage, not ML. |

## Feature Dependencies

```
[INRIX Data Collection Pipeline]
    |
    +--requires--> [Current Traffic Display]
    |                  |
    |                  +--enhances--> [Incident Overlay]
    |
    +--requires--> [Historical Data Accumulation]
                       |
                       +--requires--> [Forecast Model (baseline)]
                                          |
                                          +--enhances--> [Weather-Adjusted Forecast]
                                          |                  (requires Open-Meteo integration)
                                          |
                                          +--enhances--> [Event-Aware Predictions]
                                          |                  (requires event calendar)
                                          |
                                          +--enhances--> [School Calendar Signal]
                                          |
                                          +--requires--> [Week-Ahead Corridor View]
                                          |
                                          +--requires--> [Confidence Intervals]
                                          |                  (requires historical variance data)
                                          |
                                          +--requires--> [Best Departure Time Recommender]
                                          |                  (also requires O/D input)
                                          |
                                          +--requires--> [Congestion Risk Score]
                                          |
                                          +--requires--> [Forecast Accuracy Tracking]
                                                             (requires actuals vs predictions log)

[Interactive Map]
    +--requires--> [Mapbox setup + corridor geometry]
    +--enhances--> [Current Traffic Display]
    +--enhances--> [Incident Overlay]
    +--enhances--> [Week-Ahead Corridor View]

[O/D Route Input]
    +--requires--> [Mapbox Geocoding or corridor picker]
    +--enhances--> [Best Departure Time Recommender]
    +--enhances--> [Travel Time Estimate]
```

### Dependency Notes

- **Forecast Model requires Historical Data Accumulation:** The week-ahead model cannot produce predictions without at least 2-4 weeks of collected INRIX baseline data to establish day-of-week and hour-of-day patterns. This is the critical-path bottleneck.
- **Confidence Intervals require Historical Variance:** You need enough data points per day/hour combination to compute meaningful variance estimates. At minimum 2 weeks of data, ideally 4+.
- **Best Departure Time requires both Forecast Model and O/D Input:** It is the capstone feature combining predictions with route-specific travel time computation.
- **Forecast Accuracy Tracking requires actuals logging running in parallel with predictions:** Must start logging predictions from day one even if the dashboard is built later.
- **Weather/Event/School modifiers enhance but do not block the base forecast:** The baseline (historical average by day/hour) works without modifiers. Modifiers improve accuracy incrementally and can be added one at a time.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what is needed to validate that week-ahead forecasting is more useful than Google Maps for SF commuters.

- [ ] **INRIX data collection pipeline** -- automated hourly/periodic pulls within rate limits, storing segment speeds to database. Without data, nothing else works.
- [ ] **Interactive map with current traffic overlay** -- shows the product is real and builds trust. Users can verify current conditions match their experience.
- [ ] **Corridor-based week-ahead forecast heatmap** -- the signature view. 6 major corridors x 7 days x hourly slots. Color-coded by predicted congestion. This IS the product.
- [ ] **Confidence intervals on predictions** -- "32-44 min" not "36 min." The key differentiator. Even rough bootstrap intervals are better than false precision.
- [ ] **Weather integration** -- Open-Meteo forecast layered into predictions. This is the easiest modifier to implement and the most impactful.
- [ ] **Day/time selector** -- users pick a future date/time and see predicted conditions. Minimum interaction for forecast consumption.

### Add After Validation (v1.x)

Features to add once core forecast is working and users are trying it.

- [ ] **Best departure time recommender** -- trigger: users are checking the heatmap and manually scanning for good windows. Automate what they are doing by hand.
- [ ] **Event-aware predictions** -- trigger: a Giants game happens and the model is wildly wrong near the ballpark. Add event calendar to fix it.
- [ ] **Incident overlay** -- trigger: users want to know why current conditions differ from forecast. Show INRIX incidents.
- [ ] **Congestion risk score** -- trigger: users struggle to interpret confidence intervals. Simplify to a 1-10 score.
- [ ] **Forecast accuracy dashboard** -- trigger: enough data accumulated (4+ weeks) to show meaningful accuracy stats.
- [ ] **School calendar signal** -- trigger: model error analysis shows systematic morning rush errors on school break days.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **O/D route planner** -- significant UI and routing complexity. Corridor-based view is sufficient for MVP validation.
- [ ] **Email/notification alerts** -- requires user accounts and background job infrastructure.
- [ ] **Multi-corridor trip chaining** -- "I drive 101 to Van Ness to Market" as a single route forecast.
- [ ] **API for developers** -- if the forecast model proves valuable, expose it as an API for other apps.
- [ ] **Mobile PWA with offline support** -- service worker caching for offline access to cached forecasts.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| INRIX data collection pipeline | HIGH | MEDIUM | P1 |
| Interactive map + current traffic | HIGH | MEDIUM | P1 |
| Week-ahead corridor heatmap | HIGH | HIGH | P1 |
| Confidence intervals | HIGH | MEDIUM | P1 |
| Weather-adjusted forecasts | HIGH | LOW | P1 |
| Day/time selector | HIGH | LOW | P1 |
| Best departure time recommender | HIGH | HIGH | P2 |
| Event-aware predictions | MEDIUM | MEDIUM | P2 |
| Incident overlay | MEDIUM | LOW | P2 |
| Congestion risk score | MEDIUM | LOW | P2 |
| Forecast accuracy dashboard | MEDIUM | MEDIUM | P2 |
| School calendar signal | LOW | LOW | P2 |
| O/D route planner | MEDIUM | HIGH | P3 |
| Email digest / alerts | LOW | MEDIUM | P3 |
| Multi-corridor trip chaining | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (validates the core hypothesis)
- P2: Should have, add when possible (improves accuracy and usability)
- P3: Nice to have, future consideration (only after P1 and P2 prove value)

## Competitor Feature Analysis

| Feature | Google Maps | Waze | Apple Maps | INRIX Traffic | Our Approach |
|---------|------------|------|------------|---------------|--------------|
| Real-time traffic | Yes, probe-based | Yes, crowd-sourced | Yes, probe-based | Yes, multi-source | Yes via INRIX feed |
| Short-term forecast (0-2hr) | Yes (implicit in ETAs) | No | Yes (implicit) | Yes (Duration param) | Yes, pass through INRIX |
| Week-ahead forecast | No | No | No | Historical baselines only | **Yes -- core differentiator** |
| Confidence intervals | No (single ETA) | No | No | No (API returns single value) | **Yes -- core differentiator** |
| Weather in predictions | Reactive only (sees slowdown after rain starts) | No | Reactive only | No | **Proactive -- uses weather forecast** |
| Event awareness | Limited (some event markers) | User-reported events | Minimal | Incidents only | **Proactive -- event calendar integration** |
| Departure time optimization | "Depart at" shows one alternative | No | "Leave by" similar to Google | No | **Full week optimization with ranked windows** |
| Accuracy tracking | Internal only | No | Internal only | Some analytics products | **Public-facing -- builds trust** |
| Incidents/construction | Yes | Yes (best in class) | Yes | Yes | Yes via INRIX |
| School calendar impact | No | No | No | No | **Yes -- unique signal** |
| Corridor-level planning view | No (route-focused) | No | No | Analytics products only | **Yes -- heatmap signature view** |

**Key competitive insight:** Google Maps and Waze are optimized for "I need to go somewhere right now." Nobody serves "I want to plan my week's driving." The entire feature set should lean into planning, not real-time navigation.

## Sources

- INRIX IQ API capabilities: based on PROJECT.md context (INRIX provides current speed, historical average, free-flow reference, 0-2hr forecast, route travel times by day/hour, incidents with delay trends)
- Open-Meteo: free 7-day hourly weather forecast API (well-established, no API key required)
- Google Maps / Waze / Apple Maps feature sets: based on training data knowledge of these products as of early 2025 (MEDIUM confidence -- features may have been added since)
- Competitive gap analysis: based on PROJECT.md assertion that Google/Apple do not use weather forecasts proactively and do not show confidence intervals (HIGH confidence -- this is a well-known limitation of reactive probe-based systems)

**Confidence notes:**
- Table stakes features: HIGH confidence -- these are well-established patterns in every traffic app
- Differentiators: HIGH confidence -- the gap between reactive and proactive forecasting is structural, not likely to have changed
- Anti-features: MEDIUM confidence -- some items (like Google ToS) should be verified against current terms
- Competitor features: MEDIUM confidence -- Google/Apple may have added planning features since training cutoff, worth verifying

---
*Feature research for: SF Traffic Forecaster*
*Researched: 2026-03-19*
