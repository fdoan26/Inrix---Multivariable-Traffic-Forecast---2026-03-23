import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useCorridorSpeeds } from '@/hooks/useCorridorSpeeds';
import { useMapStore } from '@/store/mapStore';
import {
  CORRIDOR_IDS,
  CORRIDOR_DISPLAY_NAMES,
  CONGESTION_COLORS,
} from '@/data/corridors';
import { WeekHeatmap } from '@/components/WeekHeatmap';
import { DeparturePlannerForm } from '@/components/DeparturePlannerForm';
import { AccuracyDashboard } from '@/components/AccuracyDashboard';
import type { CongestionLevel } from '@/types/api';

type PanelTab = 'live' | 'plan' | 'accuracy';

function congestionLabel(level: CongestionLevel): string {
  switch (level) {
    case 'free_flow':
      return 'Free Flow';
    case 'moderate':
      return 'Moderate';
    case 'heavy':
      return 'Heavy';
    default:
      return 'Unknown';
  }
}

export function CorridorPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>('live');
  const corridorQueries = useCorridorSpeeds();
  const selectedCorridorId = useMapStore((s) => s.selectedCorridorId);
  const selectCorridor = useMapStore((s) => s.selectCorridor);
  const lastUpdated = useMapStore((s) => s.lastUpdated);
  const incidentsVisible = useMapStore((s) => s.incidentsVisible);
  const toggleIncidents = useMapStore((s) => s.toggleIncidents);

  const isFetching = corridorQueries.some((q) => q.isFetching);

  return (
    <div
      data-testid="corridor-panel"
      className="fixed bottom-0 left-0 w-full h-64 md:top-0 md:h-full md:w-80 bg-gray-900/95 backdrop-blur-sm text-gray-100 border-t md:border-t-0 md:border-r border-gray-700 overflow-y-auto z-10"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">SF Traffic</h1>
          {isFetching && (
            <span className="text-xs text-gray-400 animate-pulse">
              Updating...
            </span>
          )}
        </div>
        {lastUpdated && (
          <p className="text-xs text-gray-400 mt-1" data-testid="last-updated">
            Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
          </p>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-700" data-testid="panel-tabs">
        <button
          onClick={() => setActiveTab('live')}
          className={`px-4 py-2 text-sm ${activeTab === 'live' ? 'border-b-2 border-amber-400 text-white' : 'text-gray-400'}`}
          data-testid="tab-live"
        >Live</button>
        <button
          onClick={() => setActiveTab('plan')}
          className={`px-4 py-2 text-sm ${activeTab === 'plan' ? 'border-b-2 border-amber-400 text-white' : 'text-gray-400'}`}
          data-testid="tab-plan"
        >Plan</button>
        <button
          onClick={() => setActiveTab('accuracy')}
          className={`px-4 py-2 text-sm ${activeTab === 'accuracy' ? 'border-b-2 border-amber-400 text-white' : 'text-gray-400'}`}
          data-testid="tab-accuracy"
        >Accuracy</button>
      </div>

      {activeTab === 'live' ? (
        <>
          {/* Corridor List */}
          <div className="px-2 py-2">
            {CORRIDOR_IDS.map((id, index) => {
              const query = corridorQueries[index];
              const data = query?.data;
              const congestionLevel: CongestionLevel =
                data?.congestion_level ?? 'unknown';
              const displayName =
                data?.display_name ?? CORRIDOR_DISPLAY_NAMES[id];
              const isSelected = selectedCorridorId === id;

              return (
                <button
                  key={id}
                  onClick={() => selectCorridor(id)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-gray-700/50'
                      : 'hover:bg-gray-800/50'
                  }`}
                  data-testid={`corridor-row-${id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-100">
                      {displayName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: CONGESTION_COLORS[congestionLevel],
                        }}
                        data-testid={`congestion-badge-${id}`}
                      />
                      <span className="text-xs text-gray-400">
                        {congestionLabel(congestionLevel)}
                      </span>
                    </div>
                  </div>
                  {data && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {data.avg_travel_time_min.toFixed(1)} min
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* WeekHeatmap when corridor selected */}
          {selectedCorridorId && <WeekHeatmap corridorId={selectedCorridorId} />}

          {/* Incidents Toggle */}
          <div className="px-4 py-3 border-t border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={incidentsVisible}
                onChange={toggleIncidents}
                className="rounded border-gray-600"
                data-testid="incidents-toggle"
              />
              <span className="text-sm text-gray-300">Show Incidents</span>
            </label>
          </div>
        </>
      ) : activeTab === 'plan' ? (
        <DeparturePlannerForm />
      ) : (
        <AccuracyDashboard />
      )}
    </div>
  );
}
