import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { SubmissionService } from '../../services/submission-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getActiveDefaultBlueprintId, getOrCreateIntegrationTicketId } from '../helpers/test-submission-helpers';

describe('submission team access (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  it('grants requestors and submitters submission and upload access before ingestion completes', async () => {
    const requestorSystemUserId = connection.systemUserId();
    const otherUsers = await connection.sql(SQL`
      SELECT system_user_id
      FROM biohub.system_user
      WHERE system_user_id <> ${requestorSystemUserId}
        AND record_end_date IS NULL
      ORDER BY system_user_id
      LIMIT 2;
    `);
    expect(otherUsers.rowCount).to.equal(2);
    const initialSubmitterSystemUserId = otherUsers.rows[0].system_user_id as number;
    const appendedSubmitterSystemUserId = otherUsers.rows[1].system_user_id as number;

    const contributor = await connection.sql(SQL`
      SELECT contributor_id
      FROM contributor
      WHERE record_end_date IS NULL
      ORDER BY contributor_id
      LIMIT 1;
    `);
    const submissionUuid = randomUUID();
    const submissionService = new SubmissionService(connection);
    const { submission_id: submissionId } = await submissionService.insertSubmissionRecord(
      {
        uuid: submissionUuid,
        system_user_id: requestorSystemUserId,
        contributor_id: contributor.rows[0].contributor_id,
        name: 'Pending team access integration test',
        description: 'Submission before feature ingestion completes.',
        comment: 'Integration test'
      },
      [initialSubmitterSystemUserId, requestorSystemUserId]
    );

    const submission = await connection.sql(SQL`
      SELECT team_id
      FROM submission
      WHERE submission_id = ${submissionId};
    `);
    const submissionTeamId = submission.rows[0].team_id as string;

    await submissionService.addSubmissionTeamMembers(submissionTeamId, [
      requestorSystemUserId,
      appendedSubmitterSystemUserId
    ]);

    const submissionMembers = await connection.sql(SQL`
      SELECT system_user_id
      FROM team_member
      WHERE team_id = ${submissionTeamId}
        AND record_end_date IS NULL
      ORDER BY system_user_id;
    `);
    expect(submissionMembers.rows.map((row) => row.system_user_id)).to.deep.equal(
      [requestorSystemUserId, initialSubmitterSystemUserId, appendedSubmitterSystemUserId].sort((a, b) => a - b)
    );

    const upload = await connection.sql(SQL`
      INSERT INTO upload (upload_status, record_end_date, create_user)
      VALUES ('pending', now() + interval '30 minutes', ${requestorSystemUserId})
      RETURNING upload_id;
    `);
    const uploadId = upload.rows[0].upload_id as string;
    const ticketId = await getOrCreateIntegrationTicketId(connection, submissionId, uploadId, requestorSystemUserId);
    const blueprintId = await getActiveDefaultBlueprintId(connection);
    const submissionUploadService = new SubmissionUploadService(connection);
    const { submission_upload_id: submissionUploadId } = await submissionUploadService.insertSubmissionUpload(
      {
        submission_id: submissionId,
        upload_id: uploadId,
        ticket_id: ticketId,
        status: 'uploaded',
        blueprint_id: blueprintId
      },
      requestorSystemUserId,
      [initialSubmitterSystemUserId, appendedSubmitterSystemUserId, requestorSystemUserId]
    );

    const uploadMembers = await connection.sql(SQL`
      SELECT team_member.system_user_id
      FROM submission_upload
      JOIN team_member
        ON team_member.team_id = submission_upload.team_id
       AND team_member.record_end_date IS NULL
      WHERE submission_upload.submission_upload_id = ${submissionUploadId}
      ORDER BY team_member.system_user_id;
    `);
    expect(uploadMembers.rows.map((row) => row.system_user_id)).to.deep.equal(
      [requestorSystemUserId, initialSubmitterSystemUserId, appendedSubmitterSystemUserId].sort((a, b) => a - b)
    );

    const submissionRepository = new SubmissionRepository(connection);
    for (const systemUserId of [requestorSystemUserId, initialSubmitterSystemUserId, appendedSubmitterSystemUserId]) {
      const visibleSubmissions = await submissionRepository.getSubmissionsByUserId(
        systemUserId,
        { page: 1, limit: 10 },
        { search: 'Pending team access integration test' }
      );

      expect(visibleSubmissions).to.have.length(1);
      expect(visibleSubmissions[0]).to.include({
        submission_id: submissionId,
        security: 'PENDING'
      });
    }
  });
});
