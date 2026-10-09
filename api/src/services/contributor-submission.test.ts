import Ajv from 'ajv';
import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { SYSTEM_ROLE } from '../constants/roles';
import { ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import { HTTP403 } from '../errors/http-error';
import { SystemUserExtended } from '../models/system-user';
import { CreateSubmissionUploadRequestSchema, SubmissionUploadRequestSchema } from '../openapi/schemas/upload';
import { ContributorService } from './contributor-service';
import { SubmissionService } from './submission-service';
import { UploadIngestionService } from './upload/upload-ingestion-service';
import { PresignedUploadUrlResponse } from './upload/upload-ingestion-service.interface';

describe('Explicit submission contributor selection', () => {
  afterEach(() => sinon.restore());

  it('resolves each selected contributor independently for the same user', async () => {
    const contributorService = new ContributorService(getMockDBConnection());
    const find = sinon.stub(contributorService.contributorRepository, 'findContributorMembershipByClientId');
    find.withArgs('first', 5).resolves({ contributor_id: 1, is_member: true });
    find.withArgs('second', 5).resolves({ contributor_id: 2, is_member: true });
    expect(await contributorService.resolveAuthorizedContributorId(' first ', 5)).equals(1);
    expect(await contributorService.resolveAuthorizedContributorId('second', 5)).equals(2);
  });

  for (const clientId of [null, '', '   ', 'x'.repeat(101)]) {
    it('rejects a missing or invalid effective client ID', async () => {
      const contributorService = new ContributorService(getMockDBConnection());
      try {
        await contributorService.resolveAuthorizedContributorId(clientId, 5);
        expect.fail('Expected validation failure');
      } catch (error) {
        expect(error).instanceOf(ApiValidationError);
      }
    });
  }

  it('rejects an unknown or ended contributor without creating one', async () => {
    const contributorService = new ContributorService(getMockDBConnection());
    sinon.stub(contributorService.contributorRepository, 'findContributorMembershipByClientId').resolves(undefined);
    const create = sinon.stub(contributorService.contributorRepository, 'createContributor');
    try {
      await contributorService.resolveAuthorizedContributorId('unknown', 5);
      expect.fail('Expected missing contributor error');
    } catch (error) {
      expect(error).instanceOf(ApiNotFoundError);
    }
    expect(create.called).is.false;
  });

  it('rejects a contributor for which the authenticated user has no active membership', async () => {
    const contributorService = new ContributorService(getMockDBConnection());
    sinon
      .stub(contributorService.contributorRepository, 'findContributorMembershipByClientId')
      .withArgs('other', 5)
      .resolves({ contributor_id: 2, is_member: false });
    try {
      await contributorService.resolveAuthorizedContributorId('other', 5);
      expect.fail('Expected membership failure');
    } catch (error) {
      expect(error).instanceOf(HTTP403);
    }
  });

  it('attributes the new submission explicitly and deduplicates optional submitters', async () => {
    const uploadIngestionService = new UploadIngestionService(getMockDBConnection({ systemUserId: () => 5 }));
    const ensure = sinon
      .stub(uploadIngestionService.userService, 'ensureSystemUser')
      .resolves({ system_user_id: 12 } as any);
    const start = sinon.stub(uploadIngestionService, 'startArchiveUpload').resolves({} as PresignedUploadUrlResponse);
    sinon.stub(uploadIngestionService.submissionUploadService, 'resolveBlueprintIdForNewSubmission').resolves(7);
    await uploadIngestionService.createSubmissionArchiveUpload({
      contributorId: 2,
      bytes: 100,
      archiveFormat: 'tar.gz',
      name: 'Test',
      description: 'Description',
      comment: 'Comment',
      blueprintId: 7,
      submitters: [
        { guid: 'ABC', identifier: 'user', identitySource: 'IDIR' },
        { guid: 'abc', identifier: 'user', identitySource: 'IDIR' }
      ]
    });
    expect(ensure.calledOnce).is.true;
    expect(start.firstCall.args[1]).include({ contributor_id: 2, system_user_id: 5, default_blueprint_id: 7 });
    expect(start.firstCall.args[2]).eql([12]);
    expect(start.firstCall.args[3]).equals(7);
    expect(start.firstCall.args[4]).equals('tar.gz');
  });

  it('waits for all submitters before propagating a failure to the transaction boundary', async () => {
    const service = new UploadIngestionService(getMockDBConnection({ systemUserId: () => 5 }));
    const failure = new HTTP403('Inactive submitter');
    let finishPending!: (value: SystemUserExtended) => void;
    const pending = new Promise<SystemUserExtended>((resolve) => {
      finishPending = resolve;
    });
    const ensure = sinon.stub(service.userService, 'ensureSystemUser');
    ensure.onFirstCall().rejects(failure);
    ensure.onSecondCall().returns(pending);
    const start = sinon.stub(service, 'startArchiveUpload');
    let settled = false;
    const operation = (async () => {
      try {
        await service.createSubmissionArchiveUpload({
          contributorId: 2,
          bytes: 100,
          name: 'Test',
          description: '',
          comment: '',
          submitters: [
            { guid: 'first', identifier: 'first', identitySource: 'IDIR' },
            { guid: 'second', identifier: 'second', identitySource: 'IDIR' }
          ]
        });
        return undefined;
      } catch (error_) {
        return error_;
      } finally {
        settled = true;
      }
    })();

    await new Promise<void>((resolve) => setImmediate(resolve));
    const settledBeforePendingFinished = settled;
    finishPending({ system_user_id: 12 } as SystemUserExtended);
    const error = await operation;

    expect(settledBeforePendingFinished).to.be.false;
    expect(error).to.equal(failure);
    expect(start.called).to.be.false;
  });

  for (const schema of [CreateSubmissionUploadRequestSchema, SubmissionUploadRequestSchema]) {
    it('validates contributor selection according to the upload operation', () => {
      const validate = new Ajv({ strict: false }).compile(schema);
      const body = { bytes: 100, name: 'Test', description: '', comment: '' };
      expect(validate(body)).is.true;
      expect(validate({ ...body, client_id: 'client-name_123' })).equals(
        schema === CreateSubmissionUploadRequestSchema
      );
      for (const clientId of ['', null, 123, 'x'.repeat(101)]) {
        expect(validate({ ...body, client_id: clientId })).is.false;
      }
    });
  }
});

describe('Submission owner access', () => {
  afterEach(() => sinon.restore());

  for (const scenario of [
    { name: 'owner member', member: true, roles: [], allowed: true },
    { name: 'revoked owner member', member: false, roles: [], allowed: false },
    {
      name: 'system administrator without membership',
      member: false,
      roles: [SYSTEM_ROLE.SYSTEM_ADMIN],
      allowed: true
    },
    {
      name: 'data administrator without membership',
      member: false,
      roles: [SYSTEM_ROLE.DATA_ADMINISTRATOR],
      allowed: false
    }
  ]) {
    it(scenario.name, async () => {
      const service = new SubmissionService(getMockDBConnection({ systemUserId: () => 5 }));
      sinon
        .stub(service.submissionRepository, 'findSubmissionContributorMembership')
        .withArgs('submission', 5)
        .resolves({ is_member: scenario.member });
      sinon.stub(service.userService, 'getUserById').resolves({ role_names: scenario.roles } as SystemUserExtended);
      let failure: unknown;
      try {
        await service.assertSubmissionContributorWriteAccess('submission');
      } catch (error_) {
        failure = error_;
      }
      if (scenario.allowed) {
        expect(failure).to.be.undefined;
      } else {
        expect(failure).to.be.instanceOf(HTTP403);
      }
    });
  }

  it('allows history reads after route authorization without owning-contributor membership', async () => {
    const ingestion = new UploadIngestionService(getMockDBConnection({ systemUserId: () => 5 }));
    const uploads = ingestion.submissionUploadService;
    sinon
      .stub(uploads.submissionService.submissionRepository, 'findSubmissionContributorMembership')
      .resolves({ is_member: false });
    sinon.stub(uploads.submissionService.userService, 'getUserById').resolves({ role_names: [] } as SystemUserExtended);
    sinon.stub(uploads.submissionUploadRepository, 'findSubmissionUploadDecisionHistoryBySubmissionUuid').resolves([]);
    sinon.stub(uploads.submissionService, 'getSubmissionIdByUUID').resolves({ submission_id: 1 });

    const result = await uploads.findSubmissionDecisionHistoryByUuid('submission');

    expect(result).to.eql({ submissionId: 1, history: [] });
  });

  for (const operation of ['append', 'delete'] as const) {
    it(`${operation} rejects a revoked owner member before mutating resources`, async () => {
      const connection = getMockDBConnection({ systemUserId: () => 5 });
      const ingestion = new UploadIngestionService(connection);
      const uploads = ingestion.submissionUploadService;
      const submissionService = operation === 'append' ? ingestion.submissionService : uploads.submissionService;
      sinon
        .stub(submissionService.submissionRepository, 'findSubmissionContributorMembership')
        .resolves({ is_member: false });
      sinon
        .stub(submissionService.userService, 'getUserById')
        .resolves({ role_names: [] } as unknown as SystemUserExtended);
      sinon.stub(uploads, 'getSubmissionUploadBySubmissionUuid').resolves({ submission_id: 1 } as any);
      const addMembers = sinon.stub(ingestion.submissionService, 'addSubmissionTeamMembers');
      const start = sinon.stub(ingestion, '_startArchiveUploadForSubmission');
      const remove = sinon.stub(uploads.submissionUploadRepository, 'deleteSubmissionUpload');
      let failure: unknown;
      try {
        if (operation === 'append') {
          await ingestion.startArchiveUploadForExistingSubmissionByUuid({
            bytes: 100,
            submissionUuid: 'submission'
          });
        } else {
          await uploads.deleteSubmissionUpload('submission', 'upload');
        }
      } catch (error_) {
        failure = error_;
      }
      expect(failure).to.be.instanceOf(HTTP403);
      expect(addMembers.called).to.be.false;
      expect(start.called).to.be.false;
      expect(remove.called).to.be.false;
    });
  }
});
