import { useMemo, useCallback, useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl/mapbox';
import type { MapMouseEvent, LineLayerSpecification } from 'mapbox-gl';
import { useCorridorSpeeds } from '@/hooks/useCorridorSpeeds';
import { useIncidents } from '@/hooks/useIncidents';
import { useMapStore } from '@/store/mapStore';
import {
  CORRIDOR_IDS,
  createCorridorFeatureCollection,
} from '@/data/corridors';
import type { CongestionLevel, Incident } from '@/types/api';
import { IncidentMarker } from '@/components/IncidentMarker';
import { IncidentPopup } from '@/components/IncidentPopup';

export function MapView() {
  const corridorQueries = useCorridorSpeeds();
  const { data: incidentsData } = useIncidents();
  const selectedCorridorId = useMapStore((s) => s.selectedCorridorId);
  const incidentsVisible = useMapStore((s) => s.incidentsVisible);
  const selectCorridor = useMapStore((s) => s.selectCorridor);
  const setLastUpdated = useMapStore((s) => s.setLastUpdated);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const corridorGeoJSON = useMemo(() => {
    const corridorData = CORRIDOR_IDS.map((id, index) => {
      const query = corridorQueries[index];
      const congestionLevel: CongestionLevel =
        query?.data?.congestion_level ?? 'unknown';
      return { id, congestionLevel };
    });

    // Update lastUpdated when we have data
    const hasData = corridorQueries.some((q) => q.data);
    if (hasData) {
      setLastUpdated(new Date());
    }

    return createCorridorFeatureCollection(corridorData);
  }, [corridorQueries, setLastUpdated]);

  const corridorLineLayer: LineLayerSpecification = useMemo(
    () => ({
      id: 'corridor-lines',
      type: 'line' as const,
      source: 'corridors',
      paint: {
        'line-color': ['get', 'color'] as unknown as string,
        'line-width': 6,
        'line-opacity': selectedCorridorId
          ? ([
              'case',
              ['==', ['get', 'corridorId'], selectedCorridorId],
              1.0,
              0.6,
            ] as unknown as number)
          : 0.8,
      },
      layout: {
        'line-cap': 'round' as const,
        'line-join': 'round' as const,
      },
    }),
    [selectedCorridorId],
  );

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      const feature = e.features?.[0];
      if (feature?.properties?.corridorId) {
        selectCorridor(feature.properties.corridorId as string);
      } else {
        selectCorridor(null);
        setSelectedIncident(null);
      }
    },
    [selectCorridor],
  );

  return (
    <Map
      mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
      initialViewState={{
        longitude: -122.4194,
        latitude: 37.7749,
        zoom: 12,
      }}
      style={{ width: '100vw', height: '100vh' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      interactiveLayerIds={['corridor-lines']}
      onClick={handleMapClick}
    >
      <Source id="corridors" type="geojson" data={corridorGeoJSON}>
        <Layer {...corridorLineLayer} />
      </Source>
      {incidentsVisible &&
        incidentsData?.incidents.map((incident) => (
          <IncidentMarker
            key={incident.incident_id}
            incident={incident}
            onClick={setSelectedIncident}
          />
        ))}
      {selectedIncident && (
        <IncidentPopup
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </Map>
  );
}
