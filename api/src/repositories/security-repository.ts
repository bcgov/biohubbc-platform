import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../errors/api-error';
import { getLogger } from '../utils/logger';
import { BaseRepository } from './base-repository';

const defaultLog = getLogger('repositories/security-repository');

export const PersecutionAndHarmSecurity = z.object({
  persecution_or_harm_id: z.number(),
  persecution_or_harm_type_id: z.number(),
  wldtaxonomic_units_id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional()
});

export type PersecutionAndHarmSecurity = z.infer<typeof PersecutionAndHarmSecurity>;

/**
 * A repository for maintaining security on artifacts.
 *
 * @export
 * @class SecurityRepository
 * @extends BaseRepository
 */
export class SecurityRepository extends BaseRepository {
  async getPersecutionAndHarmRules(): Promise<PersecutionAndHarmSecurity[]> {
    defaultLog.debug({ label: 'getPersecutionAndHarmRules' });

    const sqlStatement = SQL`
      SELECT
        persecution_or_harm_id,
        persecution_or_harm_type_id,
        wldtaxonomic_units_id,
        name,
        description
      FROM
        persecution_or_harm;
    `;

    const response = await this.connection.sql<PersecutionAndHarmSecurity>(sqlStatement, PersecutionAndHarmSecurity);

    const results = (response.rowCount && response.rows) || null;

    if (!results) {
      throw new ApiExecuteSQLError('Failed to get persecution and harm rules');
    }

    return results;
  }
}
