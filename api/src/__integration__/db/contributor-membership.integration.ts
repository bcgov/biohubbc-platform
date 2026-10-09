import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { HTTP403 } from '../../errors/http-error';
import { TeamAuthorizationService } from '../../services/authorization/team-authorization-service';
import { ContributorService } from '../../services/contributor-service';
import { ContributorSystemUserService } from '../../services/contributor-system-user-service';
import { SubmissionService } from '../../services/submission-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { UploadIngestionService } from '../../services/upload/upload-ingestion-service';
import { UploadService } from '../../services/upload/upload-service';
import { createTestUpload } from '../helpers/test-feature-property-helpers';

describe('multiple contributor memberships (integration)', function () {
  this.timeout(30000);
  let connection: IDBConnection;
  let contributorService: ContributorService;
  let contributorSystemUserService: ContributorSystemUserService;
  let firstContributorId: number;
  let secondContributorId: number;
  let firstClientId: string;
  let secondClientId: string;
  let systemUserId: number;

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    systemUserId = connection.systemUserId();
    contributorService = new ContributorService(connection);
    contributorSystemUserService = new ContributorSystemUserService(connection);
    firstClientId = randomUUID();
    secondClientId = randomUUID();
    firstContributorId = await contributorService.ensureContributor(firstClientId);
    secondContributorId = await contributorService.ensureContributor(secondClientId);
  });
  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  it('authorizes the same user independently for two contributors', async () => {
    await contributorSystemUserService.ensureContributorSystemUser(firstContributorId, systemUserId);
    await contributorSystemUserService.ensureContributorSystemUser(secondContributorId, systemUserId);
    expect(await contributorService.resolveAuthorizedContributorId(firstClientId, systemUserId)).equals(
      firstContributorId
    );
    expect(await contributorService.resolveAuthorizedContributorId(secondClientId, systemUserId)).equals(
      secondContributorId
    );
  });

  it('rejects another contributor even when the caller belongs to an active contributor', async () => {
    await contributorSystemUserService.ensureContributorSystemUser(firstContributorId, systemUserId);

    try {
      await contributorService.resolveAuthorizedContributorId(secondClientId, systemUserId);
      expect.fail('Expected membership rejection');
    } catch (error_) {
      expect(error_).to.be.instanceOf(HTTP403);
    }
  });

  it('checks selected contributor membership independently of submission-team membership', async () => {
    const submissionUuid = randomUUID();
    const submissionService = new SubmissionService(connection);
    const teamAuthorizationService = new TeamAuthorizationService(connection);
    await submissionService.insertSubmissionRecord({
      uuid: submissionUuid,
      system_user_id: systemUserId,
      contributor_id: firstContributorId,
      name: 'Independent authorization checks',
      description: 'Selected contributor and submission-team access are independent.',
      comment: 'Integration test',
      default_blueprint_id: null
    });
    await contributorSystemUserService.ensureContributorSystemUser(secondContributorId, systemUserId);

    expect(await contributorService.resolveAuthorizedContributorId(secondClientId, systemUserId)).to.equal(
      secondContributorId
    );
    expect(
      await teamAuthorizationService.isUserAuthorizedForTeamEntity(systemUserId, {
        entity: 'submission',
        submissionUuid
      })
    ).to.be.true;

    await connection.sql(SQL`
      UPDATE contributor_system_user SET record_end_date = now()
      WHERE contributor_id = ${secondContributorId}
        AND system_user_id = ${systemUserId}
        AND record_end_date IS NULL
    `);
    try {
      await contributorService.resolveAuthorizedContributorId(secondClientId, systemUserId);
      expect.fail('Expected ended contributor membership rejection');
    } catch (error_) {
      expect(error_).to.be.instanceOf(HTTP403);
    }
    expect(
      await teamAuthorizationService.isUserAuthorizedForTeamEntity(systemUserId, {
        entity: 'submission',
        submissionUuid
      })
    ).to.be.true;
  });

  it('revokes submission contributor access even while team access and another membership remain', async () => {
    const submissionUuid = randomUUID();
    const submissionService = new SubmissionService(connection);
    const teamAuthorizationService = new TeamAuthorizationService(connection);
    await contributorSystemUserService.ensureContributorSystemUser(firstContributorId, systemUserId);
    await contributorSystemUserService.ensureContributorSystemUser(secondContributorId, systemUserId);
    await submissionService.insertSubmissionRecord({
      uuid: submissionUuid,
      system_user_id: systemUserId,
      contributor_id: firstContributorId,
      name: 'Contributor revocation',
      description: 'Retained unrelated membership',
      comment: 'Integration test',
      default_blueprint_id: null
    });
    const uploads = new SubmissionUploadService(connection);
    const ingestion = new UploadIngestionService(connection);
    const submission = await submissionService.getSubmissionIdByUUID(submissionUuid);
    const uploadId = await createTestUpload(connection, submission.submission_id);
    const submissionUpload = await uploads.getSubmissionUploadBySubmissionUuid(submissionUuid, uploadId);
    const uploadSessionId = submissionUpload.upload_id;
    const uploadAccess = new UploadService(connection);
    expect(await uploadAccess.isUserAuthorizedForUploadCompletion(uploadSessionId, systemUserId)).to.be.true;
    for (const [sessionId, callerId] of [
      [uploadSessionId, systemUserId + 10000],
      [randomUUID(), systemUserId]
    ] as const) {
      try {
        await uploadAccess.isUserAuthorizedForUploadCompletion(sessionId, callerId);
        expect.fail('Expected upload creator rejection');
      } catch (error_) {
        expect(error_).to.be.instanceOf(HTTP403);
      }
    }
    await connection.sql(
      SQL`UPDATE submission_upload SET record_end_date = now() WHERE submission_upload_id = ${uploadId}`
    );
    expect(await uploadAccess.uploadRepository.findUploadCompletionAccess(uploadSessionId, systemUserId)).to.be
      .undefined;
    await connection.sql(
      SQL`UPDATE submission_upload SET record_end_date = NULL WHERE submission_upload_id = ${uploadId}`
    );

    await uploads.findSubmissionDecisionHistoryByUuid(submissionUuid);
    await connection.sql(SQL`UPDATE contributor_system_user SET record_end_date = now()
      WHERE contributor_id = ${firstContributorId} AND system_user_id = ${systemUserId} AND record_end_date IS NULL`);
    expect(await contributorService.resolveAuthorizedContributorId(secondClientId, systemUserId)).to.equal(
      secondContributorId
    );
    expect(
      await teamAuthorizationService.isUserAuthorizedForTeamEntity(systemUserId, {
        entity: 'submission',
        submissionUuid
      })
    ).to.be.true;
    expect(
      (await submissionService.submissionRepository.findSubmissionContributorMembership(submissionUuid, systemUserId))
        ?.is_member ?? false
    ).to.be.false;
    expect(await uploadAccess.isUserAuthorizedForUploadCompletion(uploadSessionId, systemUserId)).to.be.false;
    const history = await uploads.findSubmissionDecisionHistoryByUuid(submissionUuid);
    expect(history.submissionId).to.equal(submission.submission_id);
    for (const operation of [
      () => uploads.deleteSubmissionUpload(submissionUuid, uploadId),
      () => ingestion.startArchiveUploadForExistingSubmissionByUuid({ bytes: 100, submissionUuid })
    ]) {
      try {
        await operation();
        expect.fail('Expected revoked owner membership rejection');
      } catch (error_) {
        expect(error_).to.be.instanceOf(HTTP403);
      }
    }
    const upload = await uploads.getSubmissionUploadBySubmissionUuid(submissionUuid, uploadId);
    expect(upload.submission_upload_id).to.equal(uploadId);
  });

  it('rejects an ended submission owner or owner membership', async () => {
    const submissionUuid = randomUUID();
    const submissionService = new SubmissionService(connection);
    await submissionService.insertSubmissionRecord({
      uuid: submissionUuid,
      system_user_id: systemUserId,
      contributor_id: firstContributorId,
      name: 'Owner membership',
      description: 'Owner authorization',
      comment: 'Integration test',
      default_blueprint_id: null
    });
    await contributorSystemUserService.ensureContributorSystemUser(firstContributorId, systemUserId);
    await submissionService.assertSubmissionContributorWriteAccess(submissionUuid);
    expect(await submissionService.submissionRepository.findSubmissionContributorMembership(randomUUID(), systemUserId))
      .to.be.undefined;
    await connection.sql(
      SQL`UPDATE contributor SET record_end_date = now() WHERE contributor_id = ${firstContributorId}`
    );
    expect(
      (await submissionService.submissionRepository.findSubmissionContributorMembership(submissionUuid, systemUserId))
        ?.is_member ?? false
    ).to.be.false;
    await connection.sql(
      SQL`UPDATE contributor SET record_end_date = NULL WHERE contributor_id = ${firstContributorId}`
    );
    await connection.sql(SQL`UPDATE contributor_system_user SET record_end_date = now()
      WHERE contributor_id = ${firstContributorId} AND system_user_id = ${systemUserId} AND record_end_date IS NULL`);
    expect(
      (await submissionService.submissionRepository.findSubmissionContributorMembership(submissionUuid, systemUserId))
        ?.is_member ?? false
    ).to.be.false;
  });

  it('keeps repeated membership creation idempotent', async () => {
    const contributorSystemUserRepository = contributorSystemUserService.contributorSystemUserRepository;
    await contributorSystemUserRepository.createContributorSystemUser(firstContributorId, systemUserId);
    const original = await contributorSystemUserService.contributorSystemUserRepository.findContributorSystemUser(
      firstContributorId,
      systemUserId
    );
    await contributorSystemUserRepository.createContributorSystemUser(firstContributorId, systemUserId);
    expect(
      await contributorSystemUserService.contributorSystemUserRepository.findContributorSystemUser(
        firstContributorId,
        systemUserId
      )
    ).eql(original);
  });

  it('retains database uniqueness for an active contributor/user pair', async () => {
    await contributorSystemUserService.ensureContributorSystemUser(firstContributorId, systemUserId);
    try {
      await connection.sql(SQL`INSERT INTO contributor_system_user (contributor_id, system_user_id)
        VALUES (${firstContributorId}, ${systemUserId})`);
      expect.fail('Expected duplicate pair rejection');
    } catch (error) {
      expect(error).instanceOf(ApiExecuteSQLError);
      const databaseError = (error as ApiExecuteSQLError).errors[0];
      expect(databaseError)
        .property('message')
        .include('duplicate key value violates unique constraint "contributor_system_uk1"');
    }
  });

  it('ignores ended memberships and preserves them when a new membership is created', async () => {
    await contributorSystemUserService.ensureContributorSystemUser(firstContributorId, systemUserId);
    const original = await contributorSystemUserService.contributorSystemUserRepository.findContributorSystemUser(
      firstContributorId,
      systemUserId
    );
    await connection.sql(SQL`UPDATE contributor_system_user SET record_end_date = now()
      WHERE contributor_system_user_id = ${original!.contributor_system_user_id}`);
    expect(
      await contributorSystemUserService.contributorSystemUserRepository.findContributorSystemUser(
        firstContributorId,
        systemUserId
      )
    ).is.null;
    try {
      await contributorService.resolveAuthorizedContributorId(firstClientId, systemUserId);
      expect.fail('Expected ended membership rejection');
    } catch (error_) {
      expect(error_).to.be.instanceOf(HTTP403);
    }
    await contributorSystemUserService.ensureContributorSystemUser(firstContributorId, systemUserId);
    const current = await contributorSystemUserService.contributorSystemUserRepository.findContributorSystemUser(
      firstContributorId,
      systemUserId
    );
    expect(current!.contributor_system_user_id).not.equals(original!.contributor_system_user_id);
    const history = await connection.sql(SQL`SELECT record_end_date FROM contributor_system_user
      WHERE contributor_system_user_id = ${original!.contributor_system_user_id}`);
    expect(history.rows[0].record_end_date).not.null;
  });

  it('does not authorize an ended contributor even with an active membership', async () => {
    await contributorSystemUserService.ensureContributorSystemUser(firstContributorId, systemUserId);
    await connection.sql(
      SQL`UPDATE contributor SET record_end_date = now() WHERE contributor_id = ${firstContributorId}`
    );
    try {
      await contributorService.resolveAuthorizedContributorId(firstClientId, systemUserId);
      expect.fail('Expected ended contributor rejection');
    } catch (error) {
      expect(error).instanceOf(ApiNotFoundError);
    }
  });
});
