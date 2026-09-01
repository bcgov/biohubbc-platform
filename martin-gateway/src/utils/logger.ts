import winston from 'winston';

/**
 * Get a logger for the given label.
 *
 * Console transport only. The gateway sits in the tile hot path, so logging stays cheap and is never
 * written to disk.
 *
 * IMPORTANT: never log the `Authorization` header or a raw token. Identify a request by its `jti`.
 *
 * @param {string} logLabel
 * @return {*}  {winston.Logger}
 */
export const getLogger = (logLabel: string): winston.Logger => {
  return winston.loggers.get(logLabel, {
    transports: [
      new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.label({ label: logLabel }),
          winston.format.printf(({ timestamp, level, label, message, ...meta }) => {
            const details = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] ${level} (${label}): ${message}${details}`;
          })
        )
      })
    ]
  });
};
