export enum ApiErrorType {
  BUILD_SQL = 'Error constructing SQL query',
  EXECUTE_SQL = 'Error executing SQL query',
  GENERAL = 'Error',
  UNKNOWN = 'Unknown Error'
}

export class ApiError extends Error {
  errors?: (string | Record<string, unknown>)[];

  constructor(name: ApiErrorType, message: string, errors?: (string | Record<string, unknown>)[], stack?: string) {
    super(message);

    this.name = name;
    this.errors = errors || [];
    this.stack = stack;

    if (stack) {
      this.stack = stack;
    }

    if (!this.stack) {
      Error.captureStackTrace(this);
    }
  }
}

/**
 * Api encountered an error.
 *
 * @export
 * @class ApiGeneralError
 * @extends {ApiError}
 */
export class ApiGeneralError extends ApiError {
  constructor(message: string, errors?: (string | Record<string, unknown>)[]) {
    super(ApiErrorType.GENERAL, message, errors);
  }
}

/**
 * API executed a query against the database, but the response was missing data, or indicated the query failed.
 *
 * Examples:
 * - A query to select rows that are expected to exist returns with `rows=[]`.
 * - A query to insert a new record returns with `rowCount=0` indicating no new row was added.
 *
 * @export
 * @class ApiExecuteSQLError
 * @extends {ApiError}
 */
export class ApiExecuteSQLError extends ApiError {
  constructor(message: string, errors?: (string | Record<string, unknown>)[]) {
    super(ApiErrorType.EXECUTE_SQL, message, errors);
  }
}
