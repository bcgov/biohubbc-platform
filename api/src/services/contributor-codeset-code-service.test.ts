import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiConflictError } from '../errors/api-error';
import { ContributorCodesetCode, CreateContributorCodesetCode } from '../models/contributor-codeset-code';
import { ContributorCodesetCodeRepository } from '../repositories/contributor-codeset-code-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ContributorCodesetCodeService } from './contributor-codeset-code-service';

chai.use(sinonChai);

describe('ContributorCodesetCodeService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: ContributorCodesetCode = {
    contributor_codeset_code_id: 1,
    contributor_codeset_id: 2,
    key: 'adult',
    label: 'Adult',
    description: 'Adult life stage',
    external_id: 'v1'
  };

  const createPayload: CreateContributorCodesetCode = {
    contributor_codeset_id: 2,
    key: 'adult',
    label: 'Adult',
    description: 'Adult life stage',
    external_id: 'v1'
  };

  it('creates when identity does not exist', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    const getStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByContributorCodesetIds')
      .resolves([]);
    const insertStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .resolves([mockRow]);

    const result = await service.createContributorCodesetCode(createPayload);

    expect(getStub).to.have.been.calledOnceWith([createPayload.contributor_codeset_id]);
    expect(insertStub).to.have.been.calledOnceWith([createPayload]);
    expect(result).to.eql(mockRow);
  });

  it('reuses existing when metadata matches', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    const getStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByContributorCodesetIds')
      .resolves([mockRow]);
    const insertStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .resolves([mockRow]);

    const result = await service.createContributorCodesetCode(createPayload);

    expect(getStub).to.have.been.calledOnceWith([createPayload.contributor_codeset_id]);
    expect(insertStub).to.not.have.been.called;
    expect(result).to.eql(mockRow);
  });

  it('throws conflict when metadata differs only by case', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    const getStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByContributorCodesetIds')
      .resolves([{ ...mockRow, label: 'ADULT', description: 'ADULT LIFE STAGE' }]);
    const insertStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .resolves([mockRow]);

    try {
      await service.createContributorCodesetCode(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiConflictError);
      expect(getStub).to.have.been.calledOnceWith([createPayload.contributor_codeset_id]);
      expect(insertStub).to.not.have.been.called;
    }
  });

  it('throws conflict when identity exists with different metadata', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByContributorCodesetIds')
      .resolves([
        {
          ...mockRow,
          label: 'Different'
        }
      ]);
    const insertStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .resolves([mockRow]);

    try {
      await service.createContributorCodesetCode(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiConflictError);
      expect(insertStub).to.not.have.been.called;
    }
  });

  it('supports bulk create and deduplicates identical identities', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    const existingRow: ContributorCodesetCode = { ...mockRow, contributor_codeset_code_id: 99 };
    sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByContributorCodesetIds')
      .resolves([existingRow]);
    const insertStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .resolves([]);

    const result = await service.createContributorCodesetCodes([createPayload, { ...createPayload }]);

    expect(insertStub).to.not.have.been.called;
    expect(result).to.eql([existingRow]);
  });

  it('does not pre-validate mixed metadata in same batch identity', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByContributorCodesetIds')
      .resolves([]);
    const insertStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .rejects(new Error('duplicate key value violates unique constraint'));

    try {
      await service.createContributorCodesetCodes([
        createPayload,
        { ...createPayload, description: 'different description' }
      ]);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(insertStub).to.have.been.calledOnce;
      expect((error as Error).message).to.equal('duplicate key value violates unique constraint');
    }
  });

  it('delegates getById', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    const stub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodeById')
      .resolves(mockRow);

    const result = await service.getContributorCodesetCodeById(1);

    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getByContributorCodesetId', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    const stub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByContributorCodesetId')
      .resolves([mockRow]);

    const result = await service.getContributorCodesetCodesByContributorCodesetId(2);

    expect(stub).to.have.been.calledOnceWith(2);
    expect(result).to.eql([mockRow]);
  });

  it('delegates findByIdentity', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    const identity = { contributor_codeset_id: 2, key: 'adult' };
    const stub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'findContributorCodesetCodeByIdentity')
      .resolves(mockRow);

    const result = await service.findContributorCodesetCodeByIdentity(identity);

    expect(stub).to.have.been.calledOnceWith(identity);
    expect(result).to.eql(mockRow);
  });

  it('propagates repository errors', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByContributorCodesetIds')
      .resolves([]);
    sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .rejects(new Error('DB error'));

    try {
      await service.createContributorCodesetCode(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
