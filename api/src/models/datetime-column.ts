/**
 * Shared suffix constants for `datetime` feature properties expanded into two
 * output columns. Used by:
 *   - the SQL projection in `download-repository.ts` `fetchTypedPropertyRows`
 *     `datetime` branch (synthetic row `name` values), and
 *   - the column-expansion helper in `parquet-utils.ts` (Parquet schema +
 *     row writer + CSV writer).
 *
 * Both sites must produce the same column names for the same input property
 * or hydrated data lands under one key while the writer reads from another,
 * silently nulling the cell. Importing from a single source eliminates that
 * regression class.
 */
export const DATETIME_DATE_SUFFIX = '_date';
export const DATETIME_TIME_SUFFIX = '_time';
