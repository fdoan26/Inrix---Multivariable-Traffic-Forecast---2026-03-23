import axios from 'axios';
import { recordCall, updateCallStatus } from '../services/budget-tracker.js';
import { withRetry } from '../services/retry.js';
import { WeatherResponseSchema } from './schemas/weather.js';
import { upsertWeatherForecasts } from '../db/queries/weather.js';
import type { WeatherRow } from '../db/queries/weather.js';
import { logJobStart, logJobEnd } from '../db/queries/budget.js';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const SF_LAT = 37.7749;
const SF_LON = -122.4194;

export async function collectWeather(): Promise<{ rowCount: number }> {
  const jobId = await logJobStart('weather');
  const callId = await recordCall('weather', OPEN_METEO_URL);
  const startTime = Date.now();

  try {
    const response = await withRetry(
      async () => {
        return await axios.get(OPEN_METEO_URL, {
          params: {
            latitude: SF_LAT,
            longitude: SF_LON,
            hourly: 'temperature_2m,precipitation,visibility,weather_code,wind_speed_10m',
            forecast_days: 7,
            timezone: 'America/Los_Angeles',
          },
          timeout: 15000,
        });
      },
      { maxAttempts: 3 }
    );

    const parsed = WeatherResponseSchema.parse(response.data);

    const rows: WeatherRow[] = parsed.hourly.time.map((t, i) => ({
      forecastHour: new Date(t),
      temperatureC: parsed.hourly.temperature_2m[i],
      precipitationMm: parsed.hourly.precipitation[i],
      visibilityM: parsed.hourly.visibility[i],
      weatherCode: parsed.hourly.weather_code[i],
      windSpeedKmh: parsed.hourly.wind_speed_10m[i],
    }));

    await upsertWeatherForecasts(rows);
    await updateCallStatus(callId, 'success', 200, Date.now() - startTime);
    await logJobEnd(jobId, 'success', rows.length);

    return { rowCount: rows.length };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    await updateCallStatus(callId, 'error', undefined, Date.now() - startTime, err.message);
    await logJobEnd(jobId, 'error', 0, err.message);
    throw err;
  }
}
