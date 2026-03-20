import { useState } from 'react';
import { useAccuracyMetrics } from '@/hooks/useAccuracyMetrics';
import type { CorridorAccuracy, DayOfWeekAccuracy } from '@/types/api';

function TrendBadge({ trend }: { trend: CorridorAccuracy['trend'] }) {
  switch (trend) {
    case 'improving':
      return <span className="text-xs text-green-400" data-testid="trend-badge">&uarr; Improving</span>;
    case 'degrading':
      return <span className="text-xs text-red-400" data-testid="trend-badge">&darr; Degrading</span>;
    default:
      return <span className="text-xs text-gray-400" data-testid="trend-badge">&rarr; Stable</span>;
  }
}

function DayOfWeekTable({ days }: { days: DayOfWeekAccuracy[] }) {
  return (
    <div className="px-6 py-1 text-xs" data-testid="dow-breakdown">
      {days.map(d => (
        <div key={d.day} className="flex justify-between py-0.5 text-gray-400">
          <span>{d.day_name}</span>
          <span>{d.mae_minutes.toFixed(1)} min / {d.mape_pct.toFixed(1)}% ({d.count})</span>
        </div>
      ))}
    </div>
  );
}

export function AccuracyDashboard() {
  const { data, isPending, isError } = useAccuracyMetrics();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isPending) {
    return (
      <div data-testid="accuracy-loading" className="text-gray-400 text-sm px-4 py-6 text-center">
        Loading accuracy data...
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="accuracy-error" className="text-red-400 text-sm px-4 py-6 text-center">
        Failed to load accuracy data.
      </div>
    );
  }

  if (!data || data.corridors.length === 0 || data.corridors.every(c => c.sample_count === 0)) {
    return (
      <div data-testid="accuracy-empty">
        <p className="text-gray-400 text-sm px-4 py-6 text-center">
          Not enough data yet — outcomes are logged automatically as forecasts mature.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="accuracy-dashboard" className="px-2 py-2">
      <div className="px-2 py-2 text-xs text-gray-400">
        Updated {new Date(data.generated_at).toLocaleString()}
      </div>
      {data.corridors.map(c => (
        <div key={c.corridor_id} className="mb-1">
          <button
            onClick={() => setExpandedId(expandedId === c.corridor_id ? null : c.corridor_id)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
            data-testid={`accuracy-row-${c.corridor_id}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-100">{c.display_name}</span>
              <TrendBadge trend={c.trend} />
            </div>
            <div className="flex gap-4 text-xs text-gray-400 mt-0.5">
              <span>{c.mae_minutes !== null ? `${c.mae_minutes.toFixed(1)} min` : '\u2014'}</span>
              <span>{c.mape_pct !== null ? `${c.mape_pct.toFixed(1)}%` : '\u2014'}</span>
              <span>{c.sample_count} samples</span>
            </div>
          </button>
          {expandedId === c.corridor_id && c.by_day_of_week.length > 0 && (
            <DayOfWeekTable days={c.by_day_of_week} />
          )}
        </div>
      ))}
    </div>
  );
}
