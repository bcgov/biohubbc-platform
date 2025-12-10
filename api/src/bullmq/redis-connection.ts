import IORedis, { RedisOptions } from 'ioredis';
import { queueConfig } from './config';

export const redisOptions: RedisOptions = {
  host: queueConfig.redisHost,
  port: queueConfig.redisPort,
  password: queueConfig.redisPassword || undefined,
  tls: queueConfig.redisUseTls ? {} : undefined, //TODO add tls config if we go that way
  maxRetriesPerRequest: null
};

export const createRedisConnection = () => new IORedis(redisOptions);
