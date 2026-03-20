import 'dotenv/config';
import { app } from './api/index.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`[server] API server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[server] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[server] Shutting down...');
  process.exit(0);
});
