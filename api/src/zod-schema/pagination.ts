import { z } from 'zod';
import { SearchFeatureCursor } from '../models/search-feature-pagination';

export const ApiPaginationSorting = z.object({
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional()
});

export type ApiPaginationSorting = z.infer<typeof ApiPaginationSorting>;

const ApiCompletePaginationSorting = z.object({
  sort: z.string(),
  order: z.enum(['asc', 'desc'])
});

/**
 * Object used to make paginated requests
 */
export const ApiPaginationOptions = ApiPaginationSorting.extend({
  limit: z.number(),
  page: z.number().min(1)
});

export type ApiPaginationOptions = z.infer<typeof ApiPaginationOptions>;

/**
 * Object used to make cursor-paginated requests.
 */
export const ApiCursorPaginationOptions = ApiCompletePaginationSorting.extend({
  limit: z.number(),
  boundary: SearchFeatureCursor.optional()
});

export type ApiCursorPaginationOptions = z.infer<typeof ApiCursorPaginationOptions>;

/**
 * Object used to represent results from paginated queries
 */
export const ApiPaginationResults = ApiPaginationSorting.extend({
  total: z.number(),
  per_page: z.number(),
  current_page: z.number(),
  last_page: z.number()
});

export type ApiPaginationResults = z.infer<typeof ApiPaginationResults>;

/**
 * Object used to represent cursor-paginated query results.
 */
export const ApiCursorPaginationResults = ApiCompletePaginationSorting.extend({
  limit: z.number(),
  next_cursor: z.string().nullable(),
  previous_cursor: z.string().nullable()
});

export type ApiCursorPaginationResults = z.infer<typeof ApiCursorPaginationResults>;
