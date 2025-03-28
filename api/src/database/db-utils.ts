import { z } from 'zod';
import { ApiExecuteSQLError } from '../errors/api-error';

/**
 * An asynchronous wrapper function that will catch any exceptions thrown by the wrapped function
 *
 * @param fn the function to be wrapped
 * @returns Promise<WrapperReturn> A Promise with the wrapped functions return value
 */
export const asyncErrorWrapper =
  <WrapperArgs extends any[], WrapperReturn>(fn: (...args: WrapperArgs) => Promise<WrapperReturn>) =>
  async (...args: WrapperArgs): Promise<WrapperReturn> => {
    try {
      return await fn(...args);
    } catch (err) {
      throw parseError(err);
    }
  };

/**
 * A synchronous wrapper function that will catch any exceptions thrown by the wrapped function
 *
 * @param fn the function to be wrapped
 * @returns WrapperReturn The wrapped functions return value
 */
export const syncErrorWrapper =
  <WrapperArgs extends any[], WrapperReturn>(fn: (...args: WrapperArgs) => WrapperReturn) =>
  (...args: WrapperArgs): WrapperReturn => {
    try {
      return fn(...args);
    } catch (err) {
      throw parseError(err);
    }
  };

/**
 * This function parses the passed in error and translates them into a human readable error
 *
 * @param error error to be parsed
 * @returns an error to throw
 */
const parseError = (error: any) => {
  if (error instanceof z.ZodError) {
    throw new ApiExecuteSQLError('SQL response failed schema check', [error as Record<string, any>]);
  }

  if (error.message === 'CONCURRENCY_EXCEPTION') {
    // error thrown by DB trigger based on revision_count
    // will be thrown if two updates to the same record are made concurrently
    throw new ApiExecuteSQLError('Failed to update stale data', [error]);
  }

  // Generic error thrown if not captured above
  throw new ApiExecuteSQLError('Failed to execute SQL', [error]);
};
