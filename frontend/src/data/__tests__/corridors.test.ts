import { describe, it, expect } from 'vitest';
import {
  CORRIDOR_IDS,
  CORRIDOR_GEOMETRIES,
  CONGESTION_COLORS,
  CORRIDOR_DISPLAY_NAMES,
  createCorridorFeatureCollection,
} from '@/data/corridors';

describe('corridors data', () => {
  it('CORRIDOR_IDS has exactly 6 entries', () => {
    expect(CORRIDOR_IDS).toHaveLength(6);
  });

  it('each corridor ID has a corresponding geometry', () => {
    for (const id of CORRIDOR_IDS) {
      expect(CORRIDOR_GEOMETRIES[id]).toBeDefined();
    }
  });

  it('each geometry is a valid LineString with [lng, lat] pairs', () => {
    for (const id of CORRIDOR_IDS) {
      const geom = CORRIDOR_GEOMETRIES[id];
      expect(geom.type).toBe('LineString');
      expect(geom.coordinates.length).toBeGreaterThanOrEqual(2);
      for (const coord of geom.coordinates) {
        expect(coord).toHaveLength(2);
        const [lng, lat] = coord;
        // SF bounding box: lng ~ -122.5 to -122.3, lat ~ 37.68 to 37.82
        expect(lng).toBeGreaterThan(-123);
        expect(lng).toBeLessThan(-122);
        expect(lat).toBeGreaterThan(37);
        expect(lat).toBeLessThan(38);
      }
    }
  });

  it('each corridor ID has a display name', () => {
    for (const id of CORRIDOR_IDS) {
      expect(CORRIDOR_DISPLAY_NAMES[id]).toBeDefined();
      expect(typeof CORRIDOR_DISPLAY_NAMES[id]).toBe('string');
    }
  });

  it('CONGESTION_COLORS has keys free_flow, moderate, heavy, unknown', () => {
    expect(CONGESTION_COLORS).toHaveProperty('free_flow');
    expect(CONGESTION_COLORS).toHaveProperty('moderate');
    expect(CONGESTION_COLORS).toHaveProperty('heavy');
    expect(CONGESTION_COLORS).toHaveProperty('unknown');
  });

  it('createCorridorFeatureCollection returns FeatureCollection with 6 features', () => {
    const data = CORRIDOR_IDS.map((id) => ({
      id,
      congestionLevel: 'free_flow' as const,
    }));
    const fc = createCorridorFeatureCollection(data);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(6);
  });

  it('features include corridorId and color properties', () => {
    const data = [
      { id: 'us-101', congestionLevel: 'heavy' as const },
      { id: 'i-280', congestionLevel: 'moderate' as const },
    ];
    const fc = createCorridorFeatureCollection(data);
    expect(fc.features[0].properties?.corridorId).toBe('us-101');
    expect(fc.features[0].properties?.color).toBe('#ef4444');
    expect(fc.features[1].properties?.corridorId).toBe('i-280');
    expect(fc.features[1].properties?.color).toBe('#f59e0b');
  });
});
