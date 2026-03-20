---
phase: 3
slug: api-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `backend/vitest.config.ts` |
| **Quick run command** | `cd backend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd backend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd backend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 03-01 | 1 | API-01, API-02 | unit | `cd backend && npx vitest run src/api/__tests__/corridors.test.ts src/api/__tests__/forecasts.test.ts --reporter=verbose` | yes | ⬜ pending |
| 3-01-02 | 03-01 | 1 | API-03 | unit | `cd backend && npx vitest run src/api/__tests__/departure-windows.test.ts src/services/__tests__/cache.test.ts --reporter=verbose` | no (W0) | ⬜ pending |
| 3-01-03 | 03-01 | 1 | API-03 | unit | `cd backend && npx vitest run src/api/__tests__/cors.test.ts src/api/__tests__/error-middleware.test.ts --reporter=verbose` | no (W0) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/api/__tests__/departure-windows.test.ts` — stubs for API-03 endpoint, Zod validation, 400/404/500 responses
- [ ] `backend/src/services/__tests__/cache.test.ts` — stubs for cache get/set/TTL expiry
- [ ] `backend/src/api/__tests__/cors.test.ts` — stubs for CORS headers on responses
- [ ] `backend/src/api/__tests__/error-middleware.test.ts` — stubs for centralized error handler returning JSON 500

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All endpoints respond in <200ms under load | API-03 | Requires live DB with real data | Run `hey -n 100 -c 10 http://localhost:3001/api/corridors/us-101-n/current` and verify p99 < 200ms |
| Cache reduces DB queries on repeated requests | API-03 | Requires DB query monitoring | Enable pg logging, call the same endpoint twice within 6 hours, verify second call hits no DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
