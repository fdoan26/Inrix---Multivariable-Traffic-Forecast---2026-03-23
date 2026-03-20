import type { FeatureCollection, LineString } from 'geojson';
import type { CongestionLevel } from '@/types/api';

export const CORRIDOR_IDS = [
  'us-101',
  'i-280',
  'bay-bridge',
  'van-ness',
  '19th-ave',
  'market-st',
] as const;

export type CorridorId = (typeof CORRIDOR_IDS)[number];

export const CONGESTION_COLORS = {
  free_flow: '#10b981',
  moderate: '#f59e0b',
  heavy: '#ef4444',
  unknown: '#6b7280',
} as const;

export const CORRIDOR_DISPLAY_NAMES: Record<CorridorId, string> = {
  'us-101': 'US-101',
  'i-280': 'I-280',
  'bay-bridge': 'Bay Bridge Approach',
  'van-ness': 'Van Ness Ave',
  '19th-ave': '19th Ave',
  'market-st': 'Market St',
};

export const CORRIDOR_GEOMETRIES: Record<CorridorId, LineString> = {
  'us-101': {
    type: 'LineString',
    coordinates: [
      [-122.387, 37.7095],
      [-122.399, 37.728],
      [-122.405, 37.747],
      [-122.415, 37.762],
      [-122.435, 37.784],
      [-122.449, 37.796],
    ],
  },
  'i-280': {
    type: 'LineString',
    coordinates: [
      [-122.448, 37.689],
      [-122.438, 37.711],
      [-122.415, 37.735],
      [-122.395, 37.757],
    ],
  },
  'bay-bridge': {
    type: 'LineString',
    coordinates: [
      [-122.37, 37.81],
      [-122.378, 37.802],
      [-122.388, 37.79],
      [-122.393, 37.783],
    ],
  },
  'van-ness': {
    type: 'LineString',
    coordinates: [
      [-122.4194, 37.7749],
      [-122.4218, 37.79],
      [-122.4235, 37.805],
    ],
  },
  '19th-ave': {
    type: 'LineString',
    coordinates: [
      [-122.4755, 37.755],
      [-122.4755, 37.74],
      [-122.4755, 37.725],
      [-122.4755, 37.71],
    ],
  },
  'market-st': {
    type: 'LineString',
    coordinates: [
      [-122.3934, 37.7946],
      [-122.407, 37.787],
      [-122.4194, 37.7749],
      [-122.435, 37.763],
    ],
  },
};

export function createCorridorFeatureCollection(
  corridorData: Array<{ id: string; congestionLevel: CongestionLevel }>,
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: corridorData.map((c) => ({
      type: 'Feature' as const,
      properties: {
        corridorId: c.id,
        color: CONGESTION_COLORS[c.congestionLevel],
      },
      geometry: CORRIDOR_GEOMETRIES[c.id as CorridorId],
    })),
  };
}
