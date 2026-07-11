import SQL from 'sql-template-strings';
import { IDBConnection } from '../database/db';
import { SubmissionTeamRepository } from '../repositories/submission-team-repository';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamService } from './access-policy/team-service';
import { DBService } from './db-service';

export class SubmissionTeamService extends DBService {
  submissionTeamRepository: SubmissionTeamRepository;
  teamService: TeamService;
  teamMemberService: TeamMemberService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionTeamRepository = new SubmissionTeamRepository(connection);
    this.teamService = new TeamService(connection);
    this.teamMemberService = new TeamMemberService(connection);
  }

  /**
   * Deterministic name for a user's personal "owner" team. One owner team is reused per user,
   * accumulating a submission_team link for each submission they create or contribute to.
   *
   * @param {number} systemUserId - The system user the owner team belongs to.
   * @return {string} The owner team name.
   * @memberof SubmissionTeamService
   */
  private getOwnerTeamName(systemUserId: number): string {
    return `Submission Owner ${systemUserId}`;
  }

  /**
   * Grant a system user access to a submission through `submission_team`.
   *
   * Access is granted by linking the submission to the user's personal owner team (a single
   * find-or-create team per user). This is independent of any ticket team membership. The
   * operation is idempotent: re-running it for the same user/submission is a no-op.
   *
   * @param {number} submissionId - The submission to grant access to.
   * @param {number} systemUserId - The system user to grant access for.
   * @return {Promise<void>}
   * @memberof SubmissionTeamService
   */
  async grantSubmissionAccessToUser(submissionId: number, systemUserId: number): Promise<void> {
    const ownerTeamName = this.getOwnerTeamName(systemUserId);

    // Serialize concurrent grants for the same user so the find-or-create below cannot race two
    // transactions into a duplicate owner team (team_nuk1) or duplicate link (submission_team_nuk1)
    // unique-constraint violation. The lock is transaction-scoped and released on commit/rollback.
    await this.connection.sql(SQL`
      SELECT pg_advisory_xact_lock(hashtext('submission_owner_team'), ${systemUserId});
    `);

    // Find-or-create the user's personal owner team, ensuring they are a member.
    const existingTeam = await this.teamService.findTeamByName(ownerTeamName);

    let teamId: string;

    if (existingTeam) {
      teamId = existingTeam.team_id;
      // createTeamMember is idempotent; ensures membership in case it was previously removed.
      await this.teamMemberService.createTeamMember({ team_id: teamId, system_user_id: systemUserId });
    } else {
      const team = await this.teamService.createTeam({
        name: ownerTeamName,
        description: `Auto-generated owner team granting submission access to system user ${systemUserId}.`,
        system_user_ids: [systemUserId]
      });
      teamId = team.team_id;
    }

    // Link the owner team to the submission (idempotent).
    await this.submissionTeamRepository.insertSubmissionTeam({ submission_id: submissionId, team_id: teamId });
  }
}
