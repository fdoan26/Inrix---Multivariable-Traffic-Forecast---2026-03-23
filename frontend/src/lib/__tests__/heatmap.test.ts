import { describe, it, expect } from 'vitest';
import { forecastToGridCoord, buildHeatmapGrid, generateDayHeaders } from '@/lib/heatmap';
import type { ForecastEntry } from '@/types/api';

const TODAY = new Date(2026, 2, 20); // March 20, 2026 (local midnight)

describe('forecastToGridCoord', () => {
  it('returns correct dayIndex and hour for a same-day forecast', () => {
    // Create a date for today at 3pm local
    const dt = new Date(2026, 2, 20, 15, 0, 0);
    const result = forecastToGridCoord(dt.toISOString(), TODAY);
    expect(result).toEqual({ dayIndex: 0, hour: 15 });
  });

  it('returns null when hour < 6 (before range)', () => {
    const dt = new Date(2026, 2, 20, 5, 0, 0);
    const result = forecastToGridCoord(dt.toISOString(), TODAY);
    expect(result).toBeNull();
  });

  it('returns null when hour > 22 (after range)', () => {
    const dt = new Date(2026, 2, 20, 23, 0, 0);
    const result = forecastToGridCoord(dt.toISOString(), TODAY);
    expect(result).toBeNull();
  });

  it('returns null when dayIndex > 6', () => {
    const dt = new Date(2026, 2, 27, 12, 0, 0); // 7 days later
    const result = forecastToGridCoord(dt.toISOString(), TODAY);
    expect(result).toBeNull();
  });

  it('returns null when dayIndex < 0 (past date)', () => {
    const dt = new Date(2026, 2, 19, 12, 0, 0);
    const result = forecastToGridCoord(dt.toISOString(), TODAY);
    expect(result).toBeNull();
  });

  it('accepts hour 6 (boundary)', () => {
    const dt = new Date(2026, 2, 20, 6, 0, 0);
    const result = forecastToGridCoord(dt.toISOString(), TODAY);
    expect(result).toEqual({ dayIndex: 0, hour: 6 });
  });

  it('accepts hour 22 (boundary)', () => {
    const dt = new Date(2026, 2, 20, 22, 0, 0);
    const result = forecastToGridCoord(dt.toISOString(), TODAY);
    expect(result).toEqual({ dayIndex: 0, hour: 22 });
  });
});

function makeForecast(overrides: Partial<ForecastEntry> & { forecast_for: string }): ForecastEntry {
  return {
    predicted_minutes: 36,
    p10_minutes: 28,
    p50_minutes: 36,
    p90_minutes: 44,
    model_version: 'baseline_v1',
    weather_modifier: 1.0,
    event_modifier: null,
    school_modifier: 1.05,
    ...overrides,
  };
}

describe('buildHeatmapGrid', () => {
  it('returns empty object for empty array', () => {
    const grid = buildHeatmapGrid([], TODAY);
    expect(grid).toEqual({});
  });

  it('populates grid[dayIndex][hour] with correct cell data', () => {
    const dt = new Date(2026, 2, 20, 15, 0, 0);
    const forecasts = [makeForecast({ forecast_for: dt.toISOString() })];
    const grid = buildHeatmapGrid(forecasts, TODAY);
    expect(grid[0][15]).toEqual({
      p10: 28,
      p50: 36,
      p90: 44,
      level: 'moderate', // 36/28 = 1.286 -> moderate
    });
  });

  it('rounds p10/p50/p90 to integers', () => {
    const dt = new Date(2026, 2, 20, 12, 0, 0);
    const forecasts = [
      makeForecast({
        forecast_for: dt.toISOString(),
        p10_minutes: 27.7,
        p50_minutes: 35.4,
        p90_minutes: 43.9,
      }),
    ];
    const grid = buildHeatmapGrid(forecasts, TODAY);
    expect(grid[0][12].p10).toBe(28);
    expect(grid[0][12].p50).toBe(35);
    expect(grid[0][12].p90).toBe(44);
  });
});

describe('generateDayHeaders', () => {
  it('returns array of 7 items', () => {
    const headers = generateDayHeaders(TODAY);
    expect(headers).toHaveLength(7);
  });

  it('formats headers as "EEE M/d"', () => {
    const headers = generateDayHeaders(TODAY);
    // March 20, 2026 is a Friday
    expect(headers[0].label).toBe('Fri 3/20');
    expect(headers[1].label).toBe('Sat 3/21');
    expect(headers[6].label).toBe('Thu 3/26');
  });

  it('provides yyyy-MM-dd keys', () => {
    const headers = generateDayHeaders(TODAY);
    expect(headers[0].key).toBe('2026-03-20');
    expect(headers[6].key).toBe('2026-03-26');
  });
});
