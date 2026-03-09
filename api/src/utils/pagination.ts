import { Request } from 'express';
import { ApiPaginationOptions, ApiPaginationResults } from '../zod-schema/pagination';

export const DEFAULT_PAGINATION_PAGE = 1;
export const DEFAULT_PAGINATION_LIMIT = 25;

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === 'number' ? value : Number(value);
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

  const sort = typeof source.sort === 'string' ? source.sort : undefined;
  const orderRaw = typeof source.order === 'string' ? source.order.toLowerCase() : undefined;
  const order = orderRaw === 'asc' || orderRaw === 'desc' ? orderRaw : undefined;

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
