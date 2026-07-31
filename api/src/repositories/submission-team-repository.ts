import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateSubmissionTeam, SubmissionTeam } from '../models/submission-team';
import { BaseRepository } from './base-repository';

/**
 * A repository class for accessing submission_team data.
 *
 * The submission_team table links a team to a submission, granting the team's members access
 * to that submission through the standard `team_member -> team -> submission_team -> submission`
 * read path.
 *
 * @export
 * @class SubmissionTeamRepository
 * @extends {BaseRepository}
 */
export class SubmissionTeamRepository extends BaseRepository {
  /**
   * Link a team to a submission, granting the team's members access to the submission.
   *
   * Idempotent: if an active link already exists for the given (submission_id, team_id), the
   * insert is skipped and `null` is returned. The unique index `submission_team_nuk1` is a
   * partial index (`WHERE record_end_date IS NULL`), so `ON CONFLICT` cannot target it; a
   * `WHERE NOT EXISTS` guard is used instead. A `rowCount` of 0 is therefore an expected,
   * non-error outcome (link already present).
   *
   * @param {CreateSubmissionTeam} data - The submission and team to link.
   * @return {Promise<SubmissionTeam | null>} The created link, or `null` if it already existed.
   * @memberof SubmissionTeamRepository
   */
  async insertSubmissionTeam(data: CreateSubmissionTeam): Promise<SubmissionTeam | null> {
    const sqlStatement = SQL`
      INSERT INTO submission_team (
        submission_id,
        team_id
      )
      SELECT
        ${data.submission_id},
        ${data.team_id}
      WHERE NOT EXISTS (
        SELECT 1
        FROM submission_team st
        WHERE st.submission_id = ${data.submission_id}
        AND st.team_id = ${data.team_id}
        AND st.record_end_date IS NULL
      )
      RETURNING
        submission_team_id,
        submission_id,
        team_id;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionTeam);

    if (response.rowCount === 0) {
      // An active link already exists; nothing inserted.
      return null;
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission team', [
        'SubmissionTeamRepository->insertSubmissionTeam',
        `expected rowCount <= 1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }
}
