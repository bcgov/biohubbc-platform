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

/**
 * Throw if any datetime property's expanded synthetic columns
 * (`<name>_date`, `<name>_time`) collide with another property's name in the
 * same feature_type schema.
 *
 * Example collision: a feature_type with datetime `observation` AND string
 * `observation_date`. The synthetic key `observation_date` would shadow the
 * real string property — last-write-wins in the SQL UNION ALL projection,
 * the hydrator's key map, and the Parquet/CSV schema field assignment. The
 * shadowing is silent and corrupts the export.
 *
 * Called at schema-build time so a misconfigured feature_type fails loud
 * before any row is hydrated. Live data is collision-free at the time this
 * check was added; the validator is forward-looking — any future
 * configuration that introduces the conflict is rejected here rather than
 * surfacing as garbled cells.
 *
 * @throws Error naming both colliding property names.
 */
export function assertNoDatetimeColumnCollisions(
  properties: ReadonlyArray<{ feature_property_name: string; feature_property_type_name: string }>
): void {
  const allNames = new Set(properties.map((p) => p.feature_property_name));

  for (const prop of properties) {
    if (prop.feature_property_type_name !== 'datetime') {
      continue;
    }

    for (const suffix of [DATETIME_DATE_SUFFIX, DATETIME_TIME_SUFFIX]) {
      const expanded = `${prop.feature_property_name}${suffix}`;
      if (allNames.has(expanded)) {
        throw new Error(
          `datetime property '${prop.feature_property_name}' expands to synthetic column ` +
            `'${expanded}', which collides with another property of the same name in the ` +
            `same feature_type. Rename one of the two properties.`
        );
      }
    }
  }
}
