import { Queue } from 'bullmq';
import { redis } from '../db/redis.js';

export const emailQueue = new Queue('email-sending', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
