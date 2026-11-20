import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { IsAuthorized } from '../models/download';
import { FormTeam } from '../models/form';
import { BaseRepository } from './base-repository';

/**
 * Persistence for the teams linked to a form for access control.
 *
 * Single authorization path for a form that is not public: form_team → team → team_member.
 *
 * @export
 * @class FormTeamRepository
 * @extends {BaseRepository}
 */
export class FormTeamRepository extends BaseRepository {
  /**
   * Get the active teams linked to a form, by name.
   *
   * @param {number} formId - Owning form.
   * @return {Promise<FormTeam[]>} Linked teams.
   * @memberof FormTeamRepository
   */
  async getFormTeams(formId: number): Promise<FormTeam[]> {
    const knex = getKnex();
    const query = knex('form_team as ft')
      .join('team as t', 't.team_id', 'ft.team_id')
      .select('t.team_id', 't.name')
      .where('ft.form_id', formId)
      .whereNull('ft.record_end_date')
      .whereNull('t.record_end_date')
      .orderBy('t.name', 'asc');

    const response = await this.connection.knex(query, FormTeam);

    return response.rows;
  }

  /**
   * End the active team links of a form that are not retained. An empty list ends every link of that form only.
   *
   * @param {number} formId - Owning form.
   * @param {string[]} teamIds - Teams to retain.
   * @return {Promise<void>}
   * @memberof FormTeamRepository
   */
  async deleteFormTeamsNotIn(formId: number, teamIds: string[]): Promise<void> {
    const sqlStatement = SQL`
      UPDATE form_team
      SET record_end_date = now()
      WHERE form_id = ${formId}
        AND record_end_date IS NULL
        AND NOT (team_id = ANY(${teamIds}::uuid[]));
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Link teams to a form in one statement, leaving existing active links unchanged.
   *
   * @param {number} formId - Owning form.
   * @param {string[]} teamIds - Teams to link.
   * @return {Promise<void>}
   * @memberof FormTeamRepository
   */
  async insertFormTeams(formId: number, teamIds: string[]): Promise<void> {
    if (!teamIds.length) {
      return;
    }

    const sqlStatement = SQL`
      INSERT INTO form_team (form_id, team_id)
      SELECT ${formId}, requested.team_id
      FROM unnest(${teamIds}::uuid[]) AS requested(team_id)
      ON CONFLICT (form_id, team_id) WHERE record_end_date IS NULL DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Check whether a user is an active member of an active team linked to a form.
   *
   * @param {number} formId - Form being accessed.
   * @param {number} systemUserId - The authenticated user's ID.
   * @return {Promise<boolean>}
   * @memberof FormTeamRepository
   */
  async isUserAuthorizedForForm(formId: number, systemUserId: number): Promise<boolean> {
    const sqlStatement = SQL`
      SELECT EXISTS (
        SELECT 1
        FROM form_team ft
        JOIN team t ON t.team_id = ft.team_id
        JOIN team_member tm ON tm.team_id = ft.team_id
        WHERE ft.form_id = ${formId}
          AND tm.system_user_id = ${systemUserId}
          AND ft.record_end_date IS NULL
          AND t.record_end_date IS NULL
          AND tm.record_end_date IS NULL
      ) AS authorized;
    `;

    const response = await this.connection.sql(sqlStatement, IsAuthorized);

    return response.rows[0]?.authorized ?? false;
  }
}
