import 'dotenv/config';
import cron from 'node-cron';
import { InrixAuthService } from './services/inrix-auth.js';
import { collectSpeeds } from './collectors/inrix-speeds.js';
import { collectIncidents } from './collectors/inrix-incidents.js';
import { collectWeather } from './collectors/weather.js';

// Initialize INRIX auth service
const auth = new InrixAuthService({
  appId: process.env.INRIX_APP_ID!,
  appKey: process.env.INRIX_APP_KEY!,
});

/**
 * Creates a job wrapper that prevents overlapping runs and catches errors.
 */
function createJob(name: string, fn: () => Promise<unknown>): () => void {
  let running = false;
  return () => {
    if (running) {
      console.log(`[${name}] Skipping - previous run still active`);
      return;
    }
    running = true;
    const start = Date.now();
    console.log(`[${name}] Starting...`);
    fn()
      .then((result) => {
        console.log(`[${name}] Complete in ${Date.now() - start}ms`, result);
      })
      .catch((error) => {
        console.error(`[${name}] Failed after ${Date.now() - start}ms`, error);
      })
      .finally(() => {
        running = false;
      });
  };
}

// Every 15 minutes: collect segment speeds
cron.schedule('*/15 * * * *', createJob('inrix_speeds', () => collectSpeeds(auth)));

// Every 30 minutes: collect incidents
cron.schedule('*/30 * * * *', createJob('inrix_incidents', () => collectIncidents(auth)));

// Daily at midnight PT (08:00 UTC): fetch 7-day weather forecast
cron.schedule('0 8 * * *', createJob('weather', () => collectWeather()));

console.log('[worker] Data collection worker started');
console.log('[worker] Schedules:');
console.log('[worker]   Speeds: every 15 minutes');
console.log('[worker]   Incidents: every 30 minutes');
console.log('[worker]   Weather: daily at 08:00 UTC (midnight PT)');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[worker] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[worker] Shutting down...');
  process.exit(0);
});
