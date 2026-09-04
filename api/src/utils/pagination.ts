import { Request } from 'express';
import { ApiValidationError } from '../errors/api-error';
import { SearchFeatureCursor } from '../models/search-feature-pagination';
import { ApiCursorPaginationOptions, ApiPaginationOptions, ApiPaginationResults } from '../zod-schema/pagination';

export const DEFAULT_PAGINATION_PAGE = 1;
export const DEFAULT_PAGINATION_LIMIT = 25;
export const DEFAULT_CURSOR_PAGINATION_SORT = 'relevancy_score';
export const DEFAULT_CURSOR_PAGINATION_ORDER = 'desc';

/**
 * Encodes a search feature cursor as a URL-safe base64 string.
 *
 * The cursor has a stable shape containing both supported positional values.
 * The request's active sort determines which values the repository uses, with
 * the ID as a deterministic tie-breaker for date sorting. Direction identifies
 * whether the position starts a next- or previous-page query. Encoding makes the
 * cursor opaque and URL-safe; it does not encrypt or sign its values.
 *
 * @param {SearchFeatureCursor} cursor - Cursor values used to continue a feature search
 * @returns {string} The encoded cursor
 */
export const encodeSearchFeatureCursor = (cursor: SearchFeatureCursor): string => {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
};

/**
 * Decodes and validates a URL-safe base64 search feature cursor.
 *
 * Decoding restores and validates the positional values and direction. The
 * current request remains the source of truth for its sort and order.
 *
 * @param {string} cursor - Encoded search feature cursor
 * @returns {SearchFeatureCursor} The decoded and validated cursor values
 */
export const decodeSearchFeatureCursor = (cursor: string): SearchFeatureCursor => {
  return SearchFeatureCursor.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
};

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return Number(value);
};

const makePaginationSortingFromSource = (
  source: Record<string, unknown>
): Pick<ApiPaginationOptions, 'sort' | 'order'> => {
  const rawOrder = typeof source.order === 'string' ? source.order.toLowerCase() : undefined;

  return {
    sort: typeof source.sort === 'string' ? source.sort : undefined,
    order: rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : undefined
  };
};

/**
 * Shared pagination extractor from a generic object.
 * Works with query params or body params.
 *
 * @param {Record<string, unknown>} source - Object containing pagination keys
 * @return {ApiPaginationOptions}
 */
const makePaginationOptionsFromSource = (source: Record<string, unknown>): ApiPaginationOptions => {
  const page = toNumber(source.page);
  const limit = toNumber(source.limit);
  const { sort, order } = makePaginationSortingFromSource(source);

  return ensureCompletePaginationOptions({ page, limit, sort, order });
};

/**
 * Returns complete pagination options by applying runtime defaults for omitted values.
 */
export const ensureCompletePaginationOptions = (
  pagination: Partial<ApiPaginationOptions> = {}
): ApiPaginationOptions => ({
  page: pagination.page ?? DEFAULT_PAGINATION_PAGE,
  limit: pagination.limit ?? DEFAULT_PAGINATION_LIMIT,
  sort: pagination.sort,
  order: pagination.order
});

/**
 * Returns complete cursor-pagination options by applying runtime defaults for omitted values.
 *
 * @param {Partial<ApiCursorPaginationOptions>} cursorPagination - Partial cursor-pagination options.
 * @returns {ApiCursorPaginationOptions} Complete cursor-pagination options.
 */
export const ensureCompleteCursorPaginationOptions = (
  cursorPagination: Partial<ApiCursorPaginationOptions> = {}
): ApiCursorPaginationOptions => ({
  limit: cursorPagination.limit ?? DEFAULT_PAGINATION_LIMIT,
  sort: cursorPagination.sort ?? DEFAULT_CURSOR_PAGINATION_SORT,
  order: cursorPagination.order ?? DEFAULT_CURSOR_PAGINATION_ORDER,
  boundary: cursorPagination.boundary
});

/**
 * Extracts pagination from query parameters
 */
export const makePaginationOptionsFromRequest = (request: Request): ApiPaginationOptions => {
  return makePaginationOptionsFromSource(request.query);
};

/**
 * Extracts pagination from request body
 */
export const makePaginationOptionsFromBody = (request: Request): ApiPaginationOptions => {
  return makePaginationOptionsFromSource(request.body.pagination ?? {});
};

/**
 * Extracts cursor pagination from request body.
 */
export const makeCursorPaginationOptionsFromBody = (request: Request): ApiCursorPaginationOptions => {
  const source = request.body.pagination ?? {};
  const limit = toNumber(source.limit);
  const { sort, order } = makePaginationSortingFromSource(source);
  let boundary: SearchFeatureCursor | undefined;

  if (typeof source.cursor === 'string') {
    try {
      boundary = decodeSearchFeatureCursor(source.cursor);
    } catch {
      throw new ApiValidationError('Invalid search result cursor');
    }
  }

  return ensureCompleteCursorPaginationOptions({
    limit,
    boundary,
    sort,
    order
  });
};

/**
 * Generates the pagination response object from the given pagination request params.
 *
 * Used with complete pagination options from `makePaginationOptionsFromRequest` or
 * `makePaginationOptionsFromBody`.
 *
 * @param {number} total
 * @param {ApiPaginationOptions} pagination
 * @returns
 */
export const makePaginationResponse = (total: number, pagination: ApiPaginationOptions): ApiPaginationResults => {
  const { page, limit, sort, order } = pagination;

  return {
    total,
    per_page: limit,
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / limit)),
    sort,
    order
  };
};
