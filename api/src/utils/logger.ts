import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { getRequestId, getRequestUser } from './async-request-storage';

const DEFAULT_LOGGER = 'default';
const MASK = '********';

/**
 * Regex used to detect sensitive keys that must be redacted.
 */
const SENSITIVE_KEY_REGEX = /(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie)/i;

/**
 * Public logger interface exposed to consumers.
 */
export type CustomLogger = {
  error: (params: CustomLoggerParams) => void;
  warn: (params: CustomLoggerParams) => void;
  info: (params: CustomLoggerParams) => void;
  debug: (params: CustomLoggerParams) => void;
  silly: (params: CustomLoggerParams) => void;
};

/**
 * Parameters accepted by all log methods.
 */
export type CustomLoggerParams = {
  label?: string;
  message?: string;
  error?: unknown;
  [key: string]: unknown;
};

/**
 * Supported Winston log levels.
 */
export const WinstonLogLevels = ['silent', 'error', 'warn', 'info', 'debug', 'silly'] as const;

export type WinstonLogLevel = (typeof WinstonLogLevels)[number];

/**
 * Get a singleton logger wrapper with a fixed logger label.
 *
 * @param logLabel Common label for the logger instance (class / file name).
 */
export const getLogger = (logLabel: string): CustomLogger => {
  const logger = getOrCreateLoggerSingleton(DEFAULT_LOGGER);

  return {
    error: (params) => logger.error(...normalizeLoggerParams(logLabel, params)),
    warn: (params) => logger.warn(...normalizeLoggerParams(logLabel, params)),
    info: (params) => logger.info(...normalizeLoggerParams(logLabel, params)),
    debug: (params) => logger.debug(...normalizeLoggerParams(logLabel, params)),
    silly: (params) => logger.silly(...normalizeLoggerParams(logLabel, params))
  };
};

/**
 * Normalize logger parameters to ensure a message is always present.
 *
 * Winston merges metadata incorrectly when `message` is omitted.
 */
const normalizeLoggerParams = (logLabel: string, params: CustomLoggerParams): [string, Record<string, unknown>] => {
  if (params.message) {
    const { message, ...rest } = params;
    return [message, { logger: logLabel, ...rest }];
  }

  return ['unknown', { logger: logLabel, ...params }];
};

/**
 * Determine which transport types should be enabled.
 * File logging is disabled during unit tests.
 */
const getTransportTypes = (): Array<'console' | 'file'> => {
  const transports: Array<'console' | 'file'> = ['console'];

  if (process.env.npm_lifecycle_event !== 'test' && process.env.npm_lifecycle_event !== 'test-watch') {
    transports.push('file');
  }

  return transports;
};

/**
 * Recursively redact sensitive values from an object or array.
 */
const redactSecrets = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => {
        if (SENSITIVE_KEY_REGEX.test(key)) {
          return [key, MASK];
        }
        return [key, redactSecrets(val)];
      })
    );
  }

  return value;
};

/**
 * Base format applied to all log entries.
 * Adds request context and redacts secrets.
 */
const baseFormat = winston.format.combine(
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp', 'logger', 'label']
  }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format((info) => ({
    timestamp: info.timestamp,
    level: info.level,
    message: info.message,
    logger: info.logger,
    label: info.label,
    requestId: getRequestId(),
    user: getRequestUser(),
    metadata: redactSecrets(info.metadata)
  }))()
);

/**
 * Pretty, colorized console output for humans.
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  baseFormat,
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';

    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

/**
 * Structured, non-colorized format for file output.
 * Intended for ingestion by log processors.
 */
const fileFormat = winston.format.combine(baseFormat, winston.format.json());

/**
 * Get or create a Winston logger singleton.
 */
const getOrCreateLoggerSingleton = (loggerName: string): winston.Logger => {
  if (winston.loggers.has(loggerName)) {
    return winston.loggers.get(loggerName);
  }

  const transports: winston.transport[] = [];
  const transportTypes = getTransportTypes();

  if (transportTypes.includes('file')) {
    transports.push(
      new DailyRotateFile({
        dirname: process.env.LOG_FILE_DIR || 'data/logs',
        filename: process.env.LOG_FILE_NAME || 'sims-api.log',
        datePattern: process.env.LOG_FILE_DATE_PATTERN || 'YYYY-MM-DD',
        maxSize: process.env.LOG_FILE_MAX_SIZE || '49m',
        maxFiles: process.env.LOG_FILE_MAX_FILES || '10',
        level: process.env.LOG_LEVEL_FILE || 'debug',
        format: fileFormat,
        options: {
          flags: 'a+',
          mode: 0o666
        }
      })
    );
  }

  if (transportTypes.includes('console')) {
    transports.push(
      new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'debug',
        format: consoleFormat
      })
    );
  }

  return winston.loggers.add(loggerName, { transports });
};

/**
 * Update console log level at runtime.
 */
export const setLogLevel = (consoleLogLevel: WinstonLogLevel): void => {
  process.env.LOG_LEVEL = consoleLogLevel;

  winston.loggers.loggers.forEach((logger) => {
    logger.transports
      .filter((t) => t instanceof winston.transports.Console)
      .forEach((t) => (t.level = consoleLogLevel));
  });
};

/**
 * Update file log level at runtime.
 */
export const setLogLevelFile = (fileLogLevel: WinstonLogLevel): void => {
  process.env.LOG_LEVEL_FILE = fileLogLevel;

  winston.loggers.loggers.forEach((logger) => {
    logger.transports.filter((t) => t instanceof DailyRotateFile).forEach((t) => (t.level = fileLogLevel));
  });
};
