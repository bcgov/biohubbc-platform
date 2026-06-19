import { SQL } from 'sql-template-strings';
import { BaseRepository } from './base-repository';

export class BlueprintRepository extends BaseRepository {
  /**
   * Find a Blueprint's id only if it is currently available for new uploads.
   *
   * A Blueprint is available when `record_end_date IS NULL` (not soft-deleted). This is the only
   * availability check applied to a caller-provided `blueprint_id`; once stored on an upload the
   * Blueprint is grandfathered in and is not re-validated during indexing.
   *
   * @param {number} blueprintId - The requested Blueprint id.
   * @returns {Promise<number | null>} - The `blueprint_id` if available, otherwise null.
   */
  async findActiveBlueprintById(blueprintId: number): Promise<number | null> {
    const sqlStatement = SQL`
      SELECT
        blueprint_id
      FROM
        blueprint
      WHERE
        blueprint_id = ${blueprintId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql<{ blueprint_id: number }>(sqlStatement);

    return response.rows[0]?.blueprint_id ?? null;
  }

  /**
   * Find the id of the active default Blueprint (`is_default = true AND record_end_date IS NULL`).
   *
   * Used as the fallback for a brand-new submission that has no prior upload to inherit a Blueprint
   * from. At most one active default Blueprint exists (enforced by a partial unique index).
   *
   * @returns {Promise<number | null>} - The default `blueprint_id`, or null if none is configured.
   */
  async findDefaultBlueprintId(): Promise<number | null> {
    const sqlStatement = SQL`
      SELECT
        blueprint_id
      FROM
        blueprint
      WHERE
        is_default = true
        AND record_end_date IS NULL
      ORDER BY
        version_number DESC
      LIMIT 1;
    `;

    const response = await this.connection.sql<{ blueprint_id: number }>(sqlStatement);

    return response.rows[0]?.blueprint_id ?? null;
  }
}
