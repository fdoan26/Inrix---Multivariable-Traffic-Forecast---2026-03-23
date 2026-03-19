import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { collectWeather } from '../weather.js';

vi.mock('axios');
vi.mock('../../services/budget-tracker.js', () => ({
  recordCall: vi.fn(),
  updateCallStatus: vi.fn(),
}));
vi.mock('../../db/queries/weather.js', () => ({
  upsertWeatherForecasts: vi.fn(),
}));
vi.mock('../../db/queries/budget.js', () => ({
  logJobStart: vi.fn(),
  logJobEnd: vi.fn(),
}));
vi.mock('../../services/retry.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

import { recordCall, updateCallStatus } from '../../services/budget-tracker.js';
import { upsertWeatherForecasts } from '../../db/queries/weather.js';
import { logJobStart, logJobEnd } from '../../db/queries/budget.js';

const mockedAxiosGet = vi.mocked(axios.get);
const mockedRecordCall = vi.mocked(recordCall);
const mockedUpsertWeatherForecasts = vi.mocked(upsertWeatherForecasts);
const mockedLogJobStart = vi.mocked(logJobStart);
const mockedLogJobEnd = vi.mocked(logJobEnd);

const SAMPLE_WEATHER_RESPONSE = {
  hourly: {
    time: ['2026-03-19T00:00', '2026-03-19T01:00', '2026-03-19T02:00'],
    temperature_2m: [12.5, 11.8, 11.2],
    precipitation: [0, 0.5, 1.2],
    visibility: [24000, 15000, 500],
    weather_code: [0, 61, 45],
    wind_speed_10m: [15, 20, 8],
  },
};

describe('collectWeather', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLogJobStart.mockResolvedValue(1);
    mockedRecordCall.mockResolvedValue(10);
    mockedUpsertWeatherForecasts.mockResolvedValue(3);
    vi.mocked(updateCallStatus).mockResolvedValue(undefined);
    mockedLogJobEnd.mockResolvedValue(undefined);
  });

  it('fetches from Open-Meteo with correct params', async () => {
    mockedAxiosGet.mockResolvedValue({ data: SAMPLE_WEATHER_RESPONSE });

    await collectWeather();

    expect(mockedAxiosGet).toHaveBeenCalledWith(
      'https://api.open-meteo.com/v1/forecast',
      expect.objectContaining({
        params: expect.objectContaining({
          latitude: 37.7749,
          longitude: -122.4194,
          hourly: 'temperature_2m,precipitation,visibility,weather_code,wind_speed_10m',
          forecast_days: 7,
          timezone: 'America/Los_Angeles',
        }),
        timeout: 15000,
      })
    );
  });

  it('validates response with WeatherResponseSchema', async () => {
    // Invalid response (missing required fields) should throw
    mockedAxiosGet.mockResolvedValue({ data: { hourly: { time: [] } } });

    await expect(collectWeather()).rejects.toThrow();
  });

  it('transforms hourly arrays into WeatherRow objects with correct field mapping', async () => {
    mockedAxiosGet.mockResolvedValue({ data: SAMPLE_WEATHER_RESPONSE });

    await collectWeather();

    const upsertCall = mockedUpsertWeatherForecasts.mock.calls[0][0];
    expect(upsertCall).toHaveLength(3);

    // First row
    expect(upsertCall[0]).toEqual({
      forecastHour: new Date('2026-03-19T00:00'),
      temperatureC: 12.5,
      precipitationMm: 0,
      visibilityM: 24000,
      weatherCode: 0,
      windSpeedKmh: 15,
    });

    // Third row (fog)
    expect(upsertCall[2]).toEqual({
      forecastHour: new Date('2026-03-19T02:00'),
      temperatureC: 11.2,
      precipitationMm: 1.2,
      visibilityM: 500,
      weatherCode: 45,
      windSpeedKmh: 8,
    });
  });

  it('calls upsertWeatherForecasts with correct row count', async () => {
    mockedAxiosGet.mockResolvedValue({ data: SAMPLE_WEATHER_RESPONSE });

    const result = await collectWeather();

    expect(result).toEqual({ rowCount: 3 });
    expect(mockedUpsertWeatherForecasts).toHaveBeenCalledTimes(1);
    expect(mockedUpsertWeatherForecasts.mock.calls[0][0]).toHaveLength(3);
  });

  it('maps weather_code 45 (fog) correctly', async () => {
    mockedAxiosGet.mockResolvedValue({ data: SAMPLE_WEATHER_RESPONSE });

    await collectWeather();

    const rows = mockedUpsertWeatherForecasts.mock.calls[0][0];
    const fogRow = rows.find((r) => r.weatherCode === 45);
    expect(fogRow).toBeDefined();
    expect(fogRow!.visibilityM).toBe(500);
  });

  it('logs job start and end on success', async () => {
    mockedAxiosGet.mockResolvedValue({ data: SAMPLE_WEATHER_RESPONSE });

    await collectWeather();

    expect(mockedLogJobStart).toHaveBeenCalledWith('weather');
    expect(mockedLogJobEnd).toHaveBeenCalledWith(1, 'success', 3);
  });
});
