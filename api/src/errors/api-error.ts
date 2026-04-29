import { BaseError } from './base-error';

export enum ApiErrorType {
  BUILD_SQL = 'Error constructing SQL query',
  EXECUTE_SQL = 'Error executing SQL query',
  GENERAL = 'Error',
  CONFLICT = 'Conflict',
  NOT_FOUND = 'Not Found',
  UNKNOWN = 'Unknown Error'
}

export class ApiError extends BaseError {
  static readonly brand: symbol = Symbol.for('@biohub/error/ApiError');

  constructor(name: ApiErrorType, message: string, errors?: (string | object)[], stack?: string) {
    super(name, message, errors, stack);
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
  static readonly brand: symbol = Symbol.for('@biohub/error/ApiGeneralError');

  constructor(message: string, errors?: (string | object)[]) {
    super(ApiErrorType.GENERAL, message, errors);
  }
}

/**
 * API encountered an unknown/unexpected error.
 *
 * @export
 * @class ApiUnknownError
 * @extends {ApiError}
 */
export class ApiUnknownError extends ApiError {
  static readonly brand: symbol = Symbol.for('@biohub/error/ApiUnknownError');

  constructor(message: string, errors?: (string | object)[]) {
    super(ApiErrorType.UNKNOWN, message, errors);
  }
}

/**
 * Api encountered an error related to a data conflict.
 *
 * Example: Unable to delete a record because it is referenced by another record.
 *
 * @export
 * @class ApiConflictError
 * @extends {ApiError}
 */
export class ApiConflictError extends ApiError {
  static readonly brand: symbol = Symbol.for('@biohub/error/ApiConflictError');

  constructor(message: string, errors?: (string | object)[]) {
    super(ApiErrorType.CONFLICT, message, errors);
  }
}

/**
 * Api could not find a requested resource.
 *
 * @export
 * @class ApiNotFoundError
 * @extends {ApiError}
 */
export class ApiNotFoundError extends ApiError {
  static readonly brand: symbol = Symbol.for('@biohub/error/ApiNotFoundError');

  constructor(message: string, errors?: (string | object)[]) {
    super(ApiErrorType.NOT_FOUND, message, errors);
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
  static readonly brand: symbol = Symbol.for('@biohub/error/ApiExecuteSQLError');

  constructor(message: string, errors?: (string | object)[]) {
    super(ApiErrorType.EXECUTE_SQL, message, errors);
  }
}

/**
 * API failed to build SQL a query.
 *
 * @export
 * @class ApiBuildSQLError
 * @extends {ApiError}
 */
export class ApiBuildSQLError extends ApiError {
  static readonly brand: symbol = Symbol.for('@biohub/error/ApiBuildSQLError');

  constructor(message: string, errors?: (string | object)[]) {
    super(ApiErrorType.BUILD_SQL, message, errors);
  }
}
