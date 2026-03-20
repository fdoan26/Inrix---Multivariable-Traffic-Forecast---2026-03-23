import { Marker } from 'react-map-gl/mapbox';
import type { Incident } from '@/types/api';
import { INCIDENT_TYPE_MAP } from '@/types/api';

interface IncidentMarkerProps {
  incident: Incident;
  onClick: (incident: Incident) => void;
}

function IncidentIcon({ incidentType }: { incidentType: number }) {
  const type = INCIDENT_TYPE_MAP[incidentType] ?? 'congestion';

  if (type === 'crash') {
    // Red circle with white "!"
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-label="crash">
        <circle cx="12" cy="12" r="11" fill="#ef4444" stroke="#fff" strokeWidth="1" />
        <text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold">!</text>
      </svg>
    );
  }

  if (type === 'construction') {
    // Orange triangle
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-label="construction">
        <polygon points="12,2 23,22 1,22" fill="#f97316" stroke="#fff" strokeWidth="1" />
        <text x="12" y="19" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">!</text>
      </svg>
    );
  }

  // Yellow diamond for congestion and event
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-label={type}>
      <polygon points="12,2 22,12 12,22 2,12" fill="#eab308" stroke="#fff" strokeWidth="1" />
      <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">!</text>
    </svg>
  );
}

export function IncidentMarker({ incident, onClick }: IncidentMarkerProps) {
  return (
    <Marker
      longitude={incident.longitude}
      latitude={incident.latitude}
      anchor="center"
    >
      <div
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(incident);
        }}
        data-testid={`incident-marker-${incident.incident_id}`}
      >
        <IncidentIcon incidentType={incident.incident_type} />
      </div>
    </Marker>
  );
}
