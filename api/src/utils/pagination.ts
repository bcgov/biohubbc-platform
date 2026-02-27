import { Request } from 'express';
import { ApiPaginationOptions, ApiPaginationResults } from '../zod-schema/pagination';

export const DEFAULT_PAGINATION_PAGE = 1;
export const DEFAULT_PAGINATION_LIMIT = 25;

const toNumber = (value: unknown): number | undefined =>
  typeof value === 'string' || typeof value === 'number' ? Number(value) : undefined;

/**
 * Shared pagination extractor from a generic object.
 * Works with query params or body params.
 *
 * @param {Record<string, unknown>} source - Object containing pagination keys
 * @return {Partial<ApiPaginationOptions>}
 */
const makePaginationOptionsFromSource = (source: Record<string, unknown>): Partial<ApiPaginationOptions> => {
  const page = toNumber(source.page);
  const limit = toNumber(source.limit);

  const order =
    typeof source.order === 'string' && (source.order.toLowerCase() === 'asc' || source.order.toLowerCase() === 'desc')
      ? (source.order.toLowerCase() as 'asc' | 'desc')
      : undefined;

  const sort = typeof source.sort === 'string' ? source.sort : undefined;

  return { page, limit, sort, order };
};

/**
 * Normalizes partial pagination options to include default page and limit values.
 */
export const normalizePaginationOptions = (
  pagination: Partial<ApiPaginationOptions> = {}
): ApiPaginationOptions => ({
  page: pagination.page ?? DEFAULT_PAGINATION_PAGE,
  limit: pagination.limit ?? DEFAULT_PAGINATION_LIMIT,
  sort: pagination.sort,
  order: pagination.order
});

/**
 * Extracts pagination from query parameters
 */
export const makePaginationOptionsFromRequest = (request: Request): Partial<ApiPaginationOptions> => {
  return makePaginationOptionsFromSource(request.query);
};

/**
 * Extracts pagination from request body
 */
export const makePaginationOptionsFromBody = (request: Request): Partial<ApiPaginationOptions> => {
  return makePaginationOptionsFromSource(request.body.pagination ?? {});
};

/**
 * Generates the pagination response object from the given pagination request params.
 *
 * Used in conjunction with a the output of `makePaginationOptionsFromRequest`.
 *
 * @param {number} total
 * @param {Partial<ApiPaginationOptions>} [pagination]
 * @returns
 */
export const makePaginationResponse = (
  total: number,
  pagination?: Partial<ApiPaginationOptions>
): ApiPaginationResults => {
  const normalizedPagination = normalizePaginationOptions(pagination);
  const effectiveLimit = normalizedPagination.limit;

  return {
    total,
    per_page: effectiveLimit,
    current_page: normalizedPagination.page,
    last_page: Math.max(1, Math.ceil(total / effectiveLimit)),
    sort: normalizedPagination.sort,
    order: normalizedPagination.order
  };
};

/**
 * Returns `ApiPaginationOptions` if the given pagination object contains all of the necessary request params needed to
 * facilitate pagination, otherwise returns `undefined`.
 *
 * Used in conjunction with the output of `makePaginationOptionsFromRequest`.
 *
 * @param {Partial<ApiPaginationOptions>} pagination
 * @returns {boolean}
 */
export const ensureCompletePaginationOptions = (
  pagination?: Partial<ApiPaginationOptions>
): ApiPaginationOptions => normalizePaginationOptions(pagination);
