---
phase: 05-departure-planner-and-week-ahead-view
plan: 02
subsystem: ui
tags: [react, zod, tanstack-query, date-fns, vitest, departure-planner]

requires:
  - phase: 05-departure-planner-and-week-ahead-view
    plan: 01
    provides: CorridorPanel tabs, departure-windows types and API, forecast infrastructure

provides:
  - DeparturePlannerForm component with Zod validation
  - DepartureResults component with amber highlight and confidence intervals
  - useDepartureWindows TanStack Query hook
  - CorridorPanel Plan tab wiring

affects:
  - frontend/src/components/CorridorPanel.tsx (Plan tab now renders DeparturePlannerForm)

tech-stack:
  added: [zod-v4-validation]
  patterns: [form-submit-with-state, manual-date-range-validation, congestion-color-badges]

key-files:
  created:
    - frontend/src/hooks/useDepartureWindows.ts
    - frontend/src/components/DeparturePlannerForm.tsx
    - frontend/src/components/DepartureResults.tsx
    - frontend/src/components/__tests__/DeparturePlannerForm.test.tsx
    - frontend/src/components/__tests__/DepartureResults.test.tsx
  modified:
    - frontend/src/components/CorridorPanel.tsx
    - frontend/src/components/__tests__/CorridorPanel.test.tsx

decisions:
  - Zod v4 uses .issues instead of .errors for validation error access
  - Manual date range validation instead of Zod .refine() for fake timer compatibility in tests
  - fireEvent.submit on form element instead of fireEvent.click on button for reliable jsdom submission
  - RGB color comparison in tests (jsdom converts hex to rgb)

metrics:
  duration: 7min
  completed: "2026-03-20T08:11:00Z"
  tasks: 2
  files: 7
---

# Phase 05 Plan 02: Departure Planner UI Summary

Departure planner form with Zod validation, ranked results with amber best-time highlight, congestion badges, and confidence intervals wired into CorridorPanel Plan tab.

## What Was Built

### Task 1: DeparturePlannerForm + DepartureResults + useDepartureWindows hook
**Commit:** d277d25

- **useDepartureWindows hook** (`frontend/src/hooks/useDepartureWindows.ts`): TanStack Query hook wrapping `fetchDepartureWindows` API call, enabled only when both corridorId and arrival are non-null.

- **DeparturePlannerForm** (`frontend/src/components/DeparturePlannerForm.tsx`): Form with corridor dropdown (6 corridors from CORRIDOR_IDS), date input, time input, and "Find Best Times" submit button. Zod schema validates required fields. Manual `validateArrivalRange()` check ensures arrival is within 7 days. On valid submit, sets `submittedCorridor` and `submittedArrival` state to trigger the query hook. Shows loading spinner, error message, or DepartureResults based on query state.

- **DepartureResults** (`frontend/src/components/DepartureResults.tsx`): Pure presentational component receiving `windows: DepartureWindow[]` prop. First result (best departure) highlighted with `bg-amber-900/30` and `border-amber-700`. Each result shows formatted departure time, travel time with p10-p90 confidence range, congestion dot with correct color, and italic reason text when present.

- **Test files**: 10 tests for DeparturePlannerForm (render, validation, submit, loading, error states) and 9 tests for DepartureResults (render, highlight, colors, reason text, empty state).

### Task 2: Wire into CorridorPanel Plan tab
**Commit:** e408da3

- Replaced "Departure planner coming soon" placeholder in CorridorPanel with `<DeparturePlannerForm />`.
- Added mocks for `useDepartureWindows` and `DepartureResults` in CorridorPanel tests.
- Updated Plan tab test to check for `departure-planner` testid.
- Added new test verifying Plan tab renders corridor dropdown and submit button.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 API change: .errors -> .issues**
- **Found during:** Task 1
- **Issue:** Plan used `result.error.errors.map()` but Zod v4 renamed the property to `result.error.issues`
- **Fix:** Changed to `result.error.issues.map((e) => e.message)`
- **Files modified:** `frontend/src/components/DeparturePlannerForm.tsx`
- **Commit:** d277d25

**2. [Rule 1 - Bug] Zod v4 .refine() not working with vi.useFakeTimers in jsdom**
- **Found during:** Task 1
- **Issue:** Zod `.refine()` date validation passed incorrectly in test environment despite fake timer being set
- **Fix:** Separated date range validation into standalone `validateArrivalRange()` function called after Zod base validation
- **Files modified:** `frontend/src/components/DeparturePlannerForm.tsx`
- **Commit:** d277d25

**3. [Rule 1 - Bug] fireEvent.click on submit button unreliable in jsdom with fake timers**
- **Found during:** Task 1
- **Issue:** `fireEvent.click(submitBtn)` did not trigger form's onSubmit handler in some test cases
- **Fix:** Changed tests to use `fireEvent.submit(form)` directly on the form element
- **Files modified:** `frontend/src/components/__tests__/DeparturePlannerForm.test.tsx`
- **Commit:** d277d25

**4. [Rule 1 - Bug] jsdom converts hex colors to RGB format**
- **Found during:** Task 1
- **Issue:** `element.style.backgroundColor` returns `rgb(16, 185, 129)` not `#10b981`
- **Fix:** Compare against RGB values directly instead of CONGESTION_COLORS hex constants
- **Files modified:** `frontend/src/components/__tests__/DepartureResults.test.tsx`
- **Commit:** d277d25

## Verification

- All 73 frontend tests pass (9 test files)
- All acceptance criteria met for both tasks
- PLAN-01: User can select corridor, date, time and submit form
- PLAN-02: Ranked departure windows display with travel times and congestion badges
- PLAN-03: Best time has amber highlight, reason text shows modifier explanations
