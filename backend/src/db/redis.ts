import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;
const host = process.env.REDIS_HOST || 'localhost';
const port = parseInt(process.env.REDIS_PORT || '6379', 10);
const password = process.env.REDIS_PASSWORD || undefined;

export const redis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })
  : new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
