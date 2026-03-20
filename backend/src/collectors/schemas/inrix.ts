import { z } from 'zod';

export const SpeedSegmentSchema = z.object({
  code: z.string(),
  segmentId: z.string(),
  speed: z.number(),
  reference: z.number(),
  average: z.number(),
  speedBucket: z.number().int().min(0).max(3),
  travelTimeMinutes: z.number(),
  durationMinutes: z.number().optional(),
});

export const SpeedResponseSchema = z.object({
  result: z.object({
    segmentSpeed: z.array(
      z.object({
        segments: z.array(SpeedSegmentSchema),
      })
    ),
  }),
});

export const IncidentSchema = z.object({
  id: z.string(),
  type: z.number(),
  severity: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  shortDesc: z.string(),
  longDesc: z.string().optional(),
  direction: z.string().optional(),
  impacting: z.boolean().optional(),
  delayFromTypical: z.number().optional(),
  delayFromFreeFlow: z.number().optional(),
  status: z.string().optional(),
});

export const IncidentResponseSchema = z.object({
  result: z.object({
    incidents: z.array(IncidentSchema),
  }),
});

export type SpeedSegment = z.infer<typeof SpeedSegmentSchema>;
export type SpeedResponse = z.infer<typeof SpeedResponseSchema>;
export type Incident = z.infer<typeof IncidentSchema>;
export type IncidentResponse = z.infer<typeof IncidentResponseSchema>;
