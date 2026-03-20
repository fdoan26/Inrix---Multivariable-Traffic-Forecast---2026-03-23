import { parseISO, differenceInCalendarDays, startOfDay, addDays, format } from 'date-fns';
import { deriveCongestionLevel } from '@/lib/congestion';
import type { ForecastEntry, CongestionLevel } from '@/types/api';

const FIRST_HOUR = 6;
const LAST_HOUR = 22;

export interface GridCoord {
  dayIndex: number;
  hour: number;
}

export interface HeatmapCell {
  p10: number;
  p50: number;
  p90: number;
  level: CongestionLevel;
}

export type HeatmapGrid = Record<number, Record<number, HeatmapCell>>;

export function forecastToGridCoord(forecastFor: string, today: Date): GridCoord | null {
  const dt = parseISO(forecastFor);
  const dayIndex = differenceInCalendarDays(dt, startOfDay(today));
  const hour = dt.getHours();
  if (dayIndex < 0 || dayIndex > 6) return null;
  if (hour < FIRST_HOUR || hour > LAST_HOUR) return null;
  return { dayIndex, hour };
}

export function buildHeatmapGrid(forecasts: ForecastEntry[], today?: Date): HeatmapGrid {
  const refDate = today ?? startOfDay(new Date());
  const grid: HeatmapGrid = {};
  for (const f of forecasts) {
    const coord = forecastToGridCoord(f.forecast_for, refDate);
    if (!coord) continue;
    if (!grid[coord.dayIndex]) grid[coord.dayIndex] = {};
    grid[coord.dayIndex][coord.hour] = {
      p10: Math.round(f.p10_minutes),
      p50: Math.round(f.p50_minutes),
      p90: Math.round(f.p90_minutes),
      level: deriveCongestionLevel(f.p50_minutes, f.p10_minutes),
    };
  }
  return grid;
}

export function generateDayHeaders(today?: Date): { key: string; label: string }[] {
  const refDate = today ?? startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(refDate, i);
    return {
      key: format(day, 'yyyy-MM-dd'),
      label: format(day, 'EEE M/d'),
    };
  });
}
