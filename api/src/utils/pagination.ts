import { Request } from 'express';
import { ApiPaginationOptions, ApiPaginationResults } from '../zod-schema/pagination';

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
  return {
    total,
    per_page: pagination?.limit ?? total,
    current_page: pagination?.page ?? 1,
    last_page: pagination?.limit ? Math.max(1, Math.ceil(total / pagination.limit)) : 1,
    sort: pagination?.sort,
    order: pagination?.order
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
  pagination: Partial<ApiPaginationOptions>
): ApiPaginationOptions | undefined => {
  // Type guard: ensures both properties exist
  if (pagination.limit !== undefined && pagination.page !== undefined) {
    return {
      limit: pagination.limit,
      page: pagination.page,
      order: pagination.order,
      sort: pagination.sort
    };
  }

  return undefined;
};
