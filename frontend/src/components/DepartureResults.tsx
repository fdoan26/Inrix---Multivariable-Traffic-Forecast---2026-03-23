import { format, parseISO } from 'date-fns';
import { CONGESTION_COLORS } from '@/data/corridors';
import type { DepartureWindow } from '@/types/api';

interface DepartureResultsProps {
  windows: DepartureWindow[];
}

export function DepartureResults({ windows }: DepartureResultsProps) {
  if (windows.length === 0) {
    return <p className="text-gray-400 text-sm px-2 py-4">No departure windows found</p>;
  }

  return (
    <div data-testid="departure-results" className="space-y-2 px-2 py-2">
      {windows.map((w, i) => {
        const dt = parseISO(w.departure_at);
        const timeLabel = format(dt, 'EEE M/d') + ' at ' + format(dt, 'h:mma').toLowerCase();
        const isBest = i === 0;

        return (
          <div
            key={w.departure_at}
            data-testid={`departure-window-${i}`}
            className={`rounded-lg px-3 py-2 ${isBest ? 'bg-amber-900/30 border border-amber-700' : 'bg-gray-800/50'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-100">{timeLabel}</span>
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: CONGESTION_COLORS[w.congestion_risk] }}
                data-testid={`congestion-dot-${i}`}
              />
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {Math.round(w.estimated_travel_min)} min ({Math.round(w.p10_minutes)}-{Math.round(w.p90_minutes)})
            </div>
            {w.reason && (
              <p className="text-xs text-gray-500 italic mt-0.5">{w.reason}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
