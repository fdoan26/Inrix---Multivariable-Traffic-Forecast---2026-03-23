import { describe, it, expect } from 'vitest';
import { SpeedResponseSchema, IncidentResponseSchema } from '../inrix.js';

describe('INRIX Zod Schemas', () => {
  describe('SpeedResponseSchema', () => {
    it('validates a well-formed speed response', () => {
      const payload = {
        result: {
          segmentSpeed: [
            {
              segments: [
                {
                  code: 'XDS10113_F',
                  segmentId: '442788370',
                  speed: 35.5,
                  reference: 65.0,
                  average: 42.3,
                  speedBucket: 2,
                  travelTimeMinutes: 1.8,
                },
              ],
            },
          ],
        },
      };
      const result = SpeedResponseSchema.parse(payload);
      expect(result.result.segmentSpeed[0].segments[0].segmentId).toBe('442788370');
      expect(result.result.segmentSpeed[0].segments[0].speed).toBe(35.5);
    });

    it('rejects speedBucket out of range (> 3)', () => {
      const payload = {
        result: {
          segmentSpeed: [
            {
              segments: [
                {
                  code: 'XDS10113_F',
                  segmentId: '442788370',
                  speed: 35.5,
                  reference: 65.0,
                  average: 42.3,
                  speedBucket: 5,
                  travelTimeMinutes: 1.8,
                },
              ],
            },
          ],
        },
      };
      expect(() => SpeedResponseSchema.parse(payload)).toThrow();
    });

    it('rejects missing required fields', () => {
      const payload = {
        result: {
          segmentSpeed: [
            {
              segments: [{ code: 'X', segmentId: '1' }],
            },
          ],
        },
      };
      expect(() => SpeedResponseSchema.parse(payload)).toThrow();
    });
  });

  describe('IncidentResponseSchema', () => {
    it('validates a well-formed incident response', () => {
      const payload = {
        result: {
          incidents: [
            {
              id: 'TMC-1234',
              type: 4,
              severity: 3,
              latitude: 37.7749,
              longitude: -122.4194,
              shortDesc: 'Accident on I-101',
              longDesc: 'Multi-vehicle accident blocking 2 lanes',
              direction: 'Northbound',
              impacting: true,
              delayFromTypical: 12.5,
              delayFromFreeFlow: 18.0,
              status: 'Active',
            },
          ],
        },
      };
      const result = IncidentResponseSchema.parse(payload);
      expect(result.result.incidents[0].id).toBe('TMC-1234');
      expect(result.result.incidents[0].severity).toBe(3);
    });

    it('validates incident with only required fields', () => {
      const payload = {
        result: {
          incidents: [
            {
              id: 'TMC-5678',
              type: 1,
              severity: 1,
              latitude: 37.8,
              longitude: -122.5,
              shortDesc: 'Road work',
            },
          ],
        },
      };
      const result = IncidentResponseSchema.parse(payload);
      expect(result.result.incidents[0].shortDesc).toBe('Road work');
    });
  });
});
