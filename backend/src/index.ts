import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { prisma } from './db/client.js';
import { redis } from './db/redis.js';
import emailRoutes from './routes/emailRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(authMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

app.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  let redisStatus = 'disconnected';

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      redisStatus = 'connected';
    }
  } catch {
    redisStatus = 'error';
  }

  const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    database: dbStatus,
    redis: redisStatus,
  });
});

// Handle malformed JSON in request body
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if ((err as unknown as Record<string, unknown>).type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  return res.status(500).json({ error: 'Internal server error' });
});

import './queue/worker.js';
import { stopWorker } from './queue/worker.js';

let server: ReturnType<typeof app.listen> | null = null;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close();
  }
  try {
    await stopWorker();
    await redis.quit();
    await prisma.$disconnect();
    console.log('Graceful shutdown completed');
  } catch (err) {
    console.error('Error during shutdown:', err);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
