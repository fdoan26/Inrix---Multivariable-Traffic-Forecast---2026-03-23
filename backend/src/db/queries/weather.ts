import { query } from '../connection.js';

export interface WeatherRow {
  forecastHour: Date;
  temperatureC: number;
  precipitationMm: number;
  visibilityM: number;
  weatherCode: number;
  windSpeedKmh: number;
}

export async function upsertWeatherForecasts(rows: WeatherRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const COLS_PER_ROW = 6;
  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const offset = i * COLS_PER_ROW;
    placeholders.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6})`
    );
    const r = rows[i];
    values.push(
      r.forecastHour,
      r.temperatureC,
      r.precipitationMm,
      r.visibilityM,
      r.weatherCode,
      r.windSpeedKmh
    );
  }

  const sql = `INSERT INTO weather_forecasts (forecast_hour, temperature_c, precipitation_mm, visibility_m, weather_code, wind_speed_kmh)
VALUES ${placeholders.join(', ')}
ON CONFLICT (forecast_hour) DO UPDATE SET
  fetched_at = NOW(),
  temperature_c = EXCLUDED.temperature_c,
  precipitation_mm = EXCLUDED.precipitation_mm,
  visibility_m = EXCLUDED.visibility_m,
  weather_code = EXCLUDED.weather_code,
  wind_speed_kmh = EXCLUDED.wind_speed_kmh`;

  const result = await query(sql, values);
  return result.rowCount ?? 0;
}
