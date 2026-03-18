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

  const normalizedCreatePayload: CreateContributorCodesetCode = {
    ...createPayload,
    label: 'adult',
    description: 'adult life stage'
  };

  it('creates when identity does not exist', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    const getStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByIdentities')
      .resolves([]);
    const insertStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .resolves([mockRow]);

    const result = await service.createContributorCodesetCode(createPayload);

    expect(getStub).to.have.been.calledOnceWith([
      {
        contributor_codeset_id: createPayload.contributor_codeset_id,
        key: createPayload.key
      }
    ]);
    expect(insertStub).to.have.been.calledOnceWith([normalizedCreatePayload]);
    expect(result).to.eql(mockRow);
  });

  it('reuses existing when metadata matches', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    const getStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByIdentities')
      .resolves([mockRow]);
    const insertStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .resolves([mockRow]);

    const result = await service.createContributorCodesetCode(createPayload);

    expect(getStub).to.have.been.calledOnceWith([
      {
        contributor_codeset_id: createPayload.contributor_codeset_id,
        key: createPayload.key
      }
    ]);
    expect(insertStub).to.not.have.been.called;
    expect(result).to.eql(mockRow);
  });

  it('reuses existing when metadata differs only by case', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    const getStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByIdentities')
      .resolves([
        {
          ...mockRow,
          label: 'ADULT',
          description: 'ADULT LIFE STAGE'
        }
      ]);
    const insertStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .resolves([mockRow]);

    const result = await service.createContributorCodesetCode(createPayload);

    expect(getStub).to.have.been.calledOnceWith([
      {
        contributor_codeset_id: createPayload.contributor_codeset_id,
        key: createPayload.key
      }
    ]);
    expect(insertStub).to.not.have.been.called;
    expect(result).to.eql({
      ...mockRow,
      label: 'ADULT',
      description: 'ADULT LIFE STAGE'
    });
  });

  it('throws conflict when identity exists with different metadata', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    sinon.stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByIdentities').resolves([
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
      .stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByIdentities')
      .resolves([existingRow]);
    const insertStub = sinon
      .stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes')
      .resolves([]);

    const result = await service.createContributorCodesetCodes([
      createPayload,
      { ...createPayload, label: 'ADULT', description: 'ADULT LIFE STAGE' }
    ]);

    expect(insertStub).to.not.have.been.called;
    expect(result).to.eql([existingRow, existingRow]);
  });

  it('throws conflict for mixed metadata in same batch identity', async () => {
    const service = new ContributorCodesetCodeService(getMockDBConnection());
    sinon.stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByIdentities').resolves([]);
    sinon.stub(ContributorCodesetCodeRepository.prototype, 'insertContributorCodesetCodes').resolves([]);

    try {
      await service.createContributorCodesetCodes([
        createPayload,
        { ...createPayload, description: 'different description' }
      ]);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiConflictError);
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
    sinon.stub(ContributorCodesetCodeRepository.prototype, 'getContributorCodesetCodesByIdentities').resolves([]);
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
