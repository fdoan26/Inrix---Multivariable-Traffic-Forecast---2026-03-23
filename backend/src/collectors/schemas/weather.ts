import { z } from 'zod';

export const WeatherHourlySchema = z.object({
  time: z.array(z.string()),
  temperature_2m: z.array(z.number()),
  precipitation: z.array(z.number()),
  visibility: z.array(z.number()),
  weather_code: z.array(z.number()),
  wind_speed_10m: z.array(z.number()),
});

export const WeatherResponseSchema = z.object({
  hourly: WeatherHourlySchema,
});

export type WeatherHourly = z.infer<typeof WeatherHourlySchema>;
export type WeatherResponse = z.infer<typeof WeatherResponseSchema>;
