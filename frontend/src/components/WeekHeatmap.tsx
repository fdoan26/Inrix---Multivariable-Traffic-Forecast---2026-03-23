import { useCorridorForecast } from '@/hooks/useCorridorForecast';
import { buildHeatmapGrid, generateDayHeaders } from '@/lib/heatmap';
import { CONGESTION_COLORS } from '@/data/corridors';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  return `${h}${hour < 12 ? 'am' : 'pm'}`;
}

export function WeekHeatmap({ corridorId }: { corridorId: string }) {
  const { data, isPending, isError } = useCorridorForecast(corridorId);

  if (isPending) {
    return (
      <div data-testid="heatmap-skeleton" className="px-2 py-2">
        <table className="w-full table-fixed text-[10px]">
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="w-10" />
                {Array.from({ length: 7 }, (_, i) => (
                  <td key={i}>
                    <div className="bg-gray-800 animate-pulse rounded-sm h-6" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-red-400 text-sm px-2 py-4">Failed to load forecast</p>
    );
  }

  if (!data) return null;

  const grid = buildHeatmapGrid(data.forecasts);
  const dayHeaders = generateDayHeaders();

  return (
    <div className="px-2 py-2 overflow-x-auto">
      <table data-testid="week-heatmap" className="w-full table-fixed text-[10px]">
        <thead>
          <tr>
            <th className="w-10" />
            {dayHeaders.map((d) => (
              <th key={d.key} className="text-center text-gray-400 font-normal pb-1">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour) => (
            <tr key={hour}>
              <td className="w-10 text-right pr-1 text-gray-500">{formatHour(hour)}</td>
              {dayHeaders.map((_, dayIndex) => {
                const cell = grid[dayIndex]?.[hour];
                if (!cell) {
                  return (
                    <td key={dayIndex} className="text-center text-gray-600 py-0.5">
                      -
                    </td>
                  );
                }
                return (
                  <td
                    key={dayIndex}
                    className="text-center py-0.5"
                    style={{ backgroundColor: CONGESTION_COLORS[cell.level] + '40' }}
                    title={`p10: ${cell.p10}m | p50: ${cell.p50}m | p90: ${cell.p90}m`}
                  >
                    {cell.p50}m
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
