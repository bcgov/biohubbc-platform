import { writeSync } from 'node:fs';

type LoggerParams = {
  message: string;
  error?: unknown;
  [key: string]: unknown;
};

/** Structured console logging for database jobs, flushed before an explicit process exit. */
export const getLogger = (logger: string) => {
  const log = (level: 'info' | 'error', params: LoggerParams) => {
    const entry = {
      ...params,
      timestamp: new Date().toISOString(),
      level,
      logger,
      ...(params.error instanceof Error && {
        error: { name: params.error.name, message: params.error.message, stack: params.error.stack }
      })
    };

    writeSync(level === 'error' ? 2 : 1, `${JSON.stringify(entry)}\n`);
  };

  return {
    info: (params: LoggerParams) => log('info', params),
    error: (params: LoggerParams) => log('error', params)
  };
};
