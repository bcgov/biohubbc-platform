import IORedis, { RedisOptions } from 'ioredis';
import { queueConfig } from './config';

export const redisOptions: RedisOptions = {
  host: queueConfig.redisHost,
  port: queueConfig.redisPort,
  password: queueConfig.redisPassword || undefined,
  tls: queueConfig.redisUseTls ? {} : undefined,
  maxRetriesPerRequest: null
};

export const createRedisConnection = () => new IORedis(redisOptions);
