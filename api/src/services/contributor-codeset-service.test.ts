import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiConflictError } from '../errors/api-error';
import { ContributorCodeset, CreateContributorCodeset } from '../models/contributor-codeset';
import { ContributorCodesetRepository } from '../repositories/contributor-codeset-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ContributorCodesetService } from './contributor-codeset-service';

chai.use(sinonChai);

describe('ContributorCodesetService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: ContributorCodeset = {
    contributor_codeset_id: 1,
    contributor_id: 10,
    key: 'life_stage',
    label: 'Life stage',
    description: 'Life stage codes',
    external_id: 'v1'
  };

  const createPayload: CreateContributorCodeset = {
    contributor_id: 10,
    key: 'life_stage',
    label: 'Life stage',
    description: 'Life stage codes',
    external_id: 'v1'
  };

  const normalizedCreatePayload: CreateContributorCodeset = {
    ...createPayload,
    label: 'life stage',
    description: 'life stage codes'
  };

  it('creates when identity does not exist', async () => {
    const service = new ContributorCodesetService(getMockDBConnection());
    const getStub = sinon
      .stub(ContributorCodesetRepository.prototype, 'getContributorCodesetsByIdentities')
      .resolves([]);
    const insertStub = sinon
      .stub(ContributorCodesetRepository.prototype, 'insertContributorCodesets')
      .resolves([mockRow]);

    const result = await service.createCodeset(createPayload);

    expect(getStub).to.have.been.calledOnceWith([
      {
        contributor_id: createPayload.contributor_id,
        key: createPayload.key
      }
    ]);
    expect(insertStub).to.have.been.calledOnceWith([normalizedCreatePayload]);
    expect(result).to.eql(mockRow);
  });

  it('reuses existing when metadata matches', async () => {
    const service = new ContributorCodesetService(getMockDBConnection());
    const getStub = sinon
      .stub(ContributorCodesetRepository.prototype, 'getContributorCodesetsByIdentities')
      .resolves([mockRow]);
    const insertStub = sinon
      .stub(ContributorCodesetRepository.prototype, 'insertContributorCodesets')
      .resolves([mockRow]);

    const result = await service.createCodeset(createPayload);

    expect(getStub).to.have.been.calledOnceWith([
      {
        contributor_id: createPayload.contributor_id,
        key: createPayload.key
      }
    ]);
    expect(insertStub).to.not.have.been.called;
    expect(result).to.eql(mockRow);
  });

  it('reuses existing when metadata differs only by case', async () => {
    const service = new ContributorCodesetService(getMockDBConnection());
    const getStub = sinon.stub(ContributorCodesetRepository.prototype, 'getContributorCodesetsByIdentities').resolves([
      {
        ...mockRow,
        label: 'LIFE STAGE',
        description: 'LIFE STAGE CODES'
      }
    ]);
    const insertStub = sinon
      .stub(ContributorCodesetRepository.prototype, 'insertContributorCodesets')
      .resolves([mockRow]);

    const result = await service.createCodeset(createPayload);

    expect(getStub).to.have.been.calledOnceWith([
      {
        contributor_id: createPayload.contributor_id,
        key: createPayload.key
      }
    ]);
    expect(insertStub).to.not.have.been.called;
    expect(result).to.eql({
      ...mockRow,
      label: 'LIFE STAGE',
      description: 'LIFE STAGE CODES'
    });
  });

  it('throws conflict when identity exists with different metadata', async () => {
    const service = new ContributorCodesetService(getMockDBConnection());
    sinon.stub(ContributorCodesetRepository.prototype, 'getContributorCodesetsByIdentities').resolves([
      {
        ...mockRow,
        label: 'Different'
      }
    ]);
    const insertStub = sinon
      .stub(ContributorCodesetRepository.prototype, 'insertContributorCodesets')
      .resolves([mockRow]);

    try {
      await service.createCodeset(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiConflictError);
      expect(insertStub).to.not.have.been.called;
    }
  });

  it('supports bulk create and deduplicates identical identities', async () => {
    const service = new ContributorCodesetService(getMockDBConnection());
    const existingRow: ContributorCodeset = { ...mockRow, contributor_codeset_id: 99 };
    sinon.stub(ContributorCodesetRepository.prototype, 'getContributorCodesetsByIdentities').resolves([existingRow]);
    const insertStub = sinon.stub(ContributorCodesetRepository.prototype, 'insertContributorCodesets').resolves([]);

    const result = await service.createCodesets([
      createPayload,
      { ...createPayload, label: 'LIFE STAGE', description: 'LIFE STAGE CODES' }
    ]);

    expect(insertStub).to.not.have.been.called;
    expect(result).to.eql([existingRow, existingRow]);
  });

  it('throws conflict for mixed metadata in same batch identity', async () => {
    const service = new ContributorCodesetService(getMockDBConnection());
    sinon.stub(ContributorCodesetRepository.prototype, 'getContributorCodesetsByIdentities').resolves([]);
    sinon.stub(ContributorCodesetRepository.prototype, 'insertContributorCodesets').resolves([]);

    try {
      await service.createCodesets([createPayload, { ...createPayload, description: 'different description' }]);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiConflictError);
    }
  });

  it('delegates getById', async () => {
    const service = new ContributorCodesetService(getMockDBConnection());
    const stub = sinon.stub(ContributorCodesetRepository.prototype, 'getContributorCodesetById').resolves(mockRow);

    const result = await service.getContributorCodesetById(1);

    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getByContributorId', async () => {
    const service = new ContributorCodesetService(getMockDBConnection());
    const stub = sinon
      .stub(ContributorCodesetRepository.prototype, 'getContributorCodesetsByContributorId')
      .resolves([mockRow]);

    const result = await service.getContributorCodesetsByContributorId(10);

    expect(stub).to.have.been.calledOnceWith(10);
    expect(result).to.eql([mockRow]);
  });
  it('propagates repository errors', async () => {
    const service = new ContributorCodesetService(getMockDBConnection());
    sinon.stub(ContributorCodesetRepository.prototype, 'getContributorCodesetsByIdentities').resolves([]);
    sinon.stub(ContributorCodesetRepository.prototype, 'insertContributorCodesets').rejects(new Error('DB error'));

    try {
      await service.createCodeset(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
