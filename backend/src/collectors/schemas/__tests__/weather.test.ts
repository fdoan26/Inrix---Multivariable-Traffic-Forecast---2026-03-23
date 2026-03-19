import { describe, it, expect } from 'vitest';
import { WeatherResponseSchema } from '../weather.js';

describe('Weather Zod Schema', () => {
  it('validates a well-formed Open-Meteo response', () => {
    const payload = {
      hourly: {
        time: ['2026-03-19T00:00', '2026-03-19T01:00', '2026-03-19T02:00'],
        temperature_2m: [12.5, 11.8, 11.2],
        precipitation: [0.0, 0.1, 0.0],
        visibility: [24000, 18000, 15000],
        weather_code: [0, 45, 48],
        wind_speed_10m: [8.5, 10.2, 9.8],
      },
    };
    const result = WeatherResponseSchema.parse(payload);
    expect(result.hourly.time).toHaveLength(3);
    expect(result.hourly.temperature_2m[0]).toBe(12.5);
    expect(result.hourly.weather_code[1]).toBe(45); // fog
  });

  it('rejects missing hourly fields', () => {
    const payload = {
      hourly: {
        time: ['2026-03-19T00:00'],
        temperature_2m: [12.5],
        // missing precipitation, visibility, weather_code, wind_speed_10m
      },
    };
    expect(() => WeatherResponseSchema.parse(payload)).toThrow();
  });
});
