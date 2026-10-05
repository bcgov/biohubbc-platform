import { Knex } from 'knex';
import type {
  SearchFeatureCursor,
  SearchFeatureQueryOptions,
  SearchFeatureSort
} from '../models/search-feature-pagination';

/**
 * Returns the opposite SQL sort direction.
 *
 * @example
 * `invertOrder('asc')` returns `'desc'`; `invertOrder('desc')` returns `'asc'`.
 *
 * @param {'asc' | 'desc'} order - Sort direction to reverse.
 * @return {'asc' | 'desc'} Opposite sort direction.
 */
const invertOrder = (order: 'asc' | 'desc'): 'asc' | 'desc' => (order === 'asc' ? 'desc' : 'asc');

/**
 * Applies stable keyset ordering, an optional cursor boundary, and an optional page limit.
 *
 * @example
 * `{ sort: 'create_date', order: 'desc', boundary: nextCursor, limit: 25 }` applies a descending tuple boundary on
 * `(create_date, submission_feature_id)`, orders by both columns, and limits the query to 25 rows. A previous-page
 * boundary reverses traversal so the adjacent rows can be fetched efficiently; the caller restores display order.
 *
 * @param {Knex.QueryBuilder} query - Anchor query to paginate.
 * @param {string} tableAlias - Alias qualifying the sortable anchor columns.
 * @param {SearchFeatureQueryOptions} [options] - Validated ordering, cursor boundary, and page limit.
 * @return {void}
 */
export function applySearchQueryOptions(
  query: Knex.QueryBuilder,
  tableAlias: string,
  options?: SearchFeatureQueryOptions
): void {
  if (!options) {
    return;
  }

  const isPreviousPage = options.boundary?.direction === 'previous';
  const traversalOrder = isPreviousPage ? invertOrder(options.order) : options.order;

  if (options.boundary) {
    applySearchCursor(query, tableAlias, options.sort, traversalOrder, options.boundary);
  }

  query.orderBy(`${tableAlias}.${options.sort}`, traversalOrder);

  if (options.sort !== 'submission_feature_id') {
    query.orderBy(`${tableAlias}.submission_feature_id`, traversalOrder);
  }

  if (options.limit) {
    query.limit(options.limit);
  }
}

/**
 * Applies the exclusive keyset boundary represented by a search cursor.
 *
 * @example
 * ID sort ascending with cursor ID 100 adds `submission_feature_id > 100`.
 * Creation-date sort descending adds `(create_date, submission_feature_id) < (?, ?)` so equal timestamps resume from
 * the unique feature-ID tie-breaker without gaps or duplicates.
 *
 * @param {Knex.QueryBuilder} query - Query receiving the cursor predicate.
 * @param {string} tableAlias - Alias qualifying the cursor columns.
 * @param {SearchFeatureSort} sort - Active sort column.
 * @param {'asc' | 'desc'} order - Traversal direction for the primary sort column.
 * @param {SearchFeatureCursor} cursor - Decoded exclusive boundary.
 * @return {void}
 */
function applySearchCursor(
  query: Knex.QueryBuilder,
  tableAlias: string,
  sort: SearchFeatureSort,
  order: 'asc' | 'desc',
  cursor: SearchFeatureCursor
): void {
  const sortOperator = order === 'asc' ? '>' : '<';

  if (sort === 'submission_feature_id') {
    query.whereRaw(`?? ${sortOperator} ?`, [`${tableAlias}.submission_feature_id`, cursor.submission_feature_id]);
    return;
  }

  query.whereRaw(`(??, ??) ${sortOperator} (?, ?)`, [
    `${tableAlias}.create_date`,
    `${tableAlias}.submission_feature_id`,
    cursor.create_date,
    cursor.submission_feature_id
  ]);
}
