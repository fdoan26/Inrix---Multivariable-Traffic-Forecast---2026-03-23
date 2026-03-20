import { Popup } from 'react-map-gl/mapbox';
import { formatDistanceToNow } from 'date-fns';
import type { Incident } from '@/types/api';
import { INCIDENT_TYPE_MAP } from '@/types/api';

interface IncidentPopupProps {
  incident: Incident;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  crash: 'Crash',
  construction: 'Construction',
  congestion: 'Congestion',
  event: 'Event',
};

export function IncidentPopup({ incident, onClose }: IncidentPopupProps) {
  const type = INCIDENT_TYPE_MAP[incident.incident_type] ?? 'congestion';
  const label = TYPE_LABELS[type] ?? 'Incident';
  const timeAgo = formatDistanceToNow(new Date(incident.recorded_at), { addSuffix: true });

  return (
    <Popup
      longitude={incident.longitude}
      latitude={incident.latitude}
      onClose={onClose}
      closeOnClick={false}
      className="incident-popup"
    >
      <div className="bg-gray-800 text-gray-100 p-3 rounded-lg min-w-48">
        <div className="font-semibold text-sm mb-1" data-testid="incident-type-label">
          {label}
        </div>
        <div className="text-sm text-gray-300 mb-2" data-testid="incident-description">
          {incident.short_desc}
        </div>
        {incident.delay_from_typical_min != null && (
          <div className="text-sm text-yellow-400 mb-1" data-testid="incident-delay">
            Delay: {Math.round(incident.delay_from_typical_min)} min
          </div>
        )}
        <div className="text-xs text-gray-400" data-testid="incident-time">
          {timeAgo}
        </div>
      </div>
    </Popup>
  );
}
