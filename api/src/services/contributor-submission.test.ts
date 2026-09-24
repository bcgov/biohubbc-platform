import Ajv from 'ajv';
import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import { HTTP403 } from '../errors/http-error';
import { CreateSubmissionUploadRequestSchema, SubmissionUploadRequestSchema } from '../openapi/schemas/upload';
import { ContributorService } from './contributor-service';
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
    await uploadIngestionService.createSubmissionArchiveUpload({
      contributorId: 2,
      bytes: 100,
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
    expect(start.firstCall.args[1]).include({ contributor_id: 2, system_user_id: 5 });
    expect(start.firstCall.args[2]).eql([12]);
    expect(start.firstCall.args[3]).equals(7);
  });

  for (const schema of [CreateSubmissionUploadRequestSchema, SubmissionUploadRequestSchema]) {
    it('accepts an omitted client_id but validates provided values', () => {
      const validate = new Ajv({ strict: false }).compile(schema);
      const body = { bytes: 100, name: 'Test', description: '', comment: '' };
      expect(validate(body)).is.true;
      expect(validate({ ...body, client_id: 'client-name_123' })).is.true;
      for (const clientId of ['', null, 123, 'x'.repeat(101)]) {
        expect(validate({ ...body, client_id: clientId })).is.false;
      }
    });
  }
});
