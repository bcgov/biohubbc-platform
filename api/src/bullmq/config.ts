import { z } from 'zod';

const envSchema = z.object({
  queueName: z.string().min(1).default('submission-jobs'),
  redisHost: z.string().min(1).default('redis'),
  redisPort: z.coerce.number().int().positive().default(6379),
  redisPassword: z.string().optional(),
  redisUseTls: z.coerce.boolean().default(false),
  syncIntervalMs: z.coerce.number().positive().default(5000),
  workerConcurrency: z.coerce.number().int().positive().default(2),
  jobAttempts: z.coerce.number().int().positive().default(3),
  jobTimeoutMs: z.coerce.number().positive().default(600000),
  jobBackoffMs: z.coerce.number().nonnegative().default(10000)
});

export const queueConfig = envSchema.parse({
  queueName: process.env.BULLMQ_QUEUE_NAME,
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT,
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  redisUseTls: process.env.REDIS_USE_TLS,
  syncIntervalMs: process.env.BULLMQ_SYNC_INTERVAL_MS,
  workerConcurrency: process.env.BULLMQ_WORKER_CONCURRENCY,
  jobAttempts: process.env.BULLMQ_JOB_ATTEMPTS,
  jobTimeoutMs: process.env.BULLMQ_JOB_TIMEOUT_MS,
  jobBackoffMs: process.env.BULLMQ_JOB_BACKOFF_MS
});
