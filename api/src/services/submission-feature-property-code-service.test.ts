import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import {
  CreateSubmissionFeaturePropertyCode,
  SubmissionFeaturePropertyCode
} from '../models/submission-feature-property-code';
import { SubmissionFeaturePropertyCodeRepository } from '../repositories/submission-feature-property-code-repository';
import { SubmissionFeaturePropertyCodeService } from './submission-feature-property-code-service';

chai.use(sinonChai);

describe('SubmissionFeaturePropertyCodeService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyCode = {
    submission_feature_property_code_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    contributor_codeset_code_id: 30
  };

  const createPayload: CreateSubmissionFeaturePropertyCode = {
    submission_feature_id: 10,
    feature_type_property_id: 20,
    contributor_codeset_code_id: 30
  };

  it('delegates create', async () => {
    const service = new SubmissionFeaturePropertyCodeService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyCodeRepository.prototype, 'insertSubmissionFeaturePropertyCode')
      .resolves(mockRow);

    const result = await service.createSubmissionFeaturePropertyCode(createPayload);

    expect(stub).to.have.been.calledOnceWith(createPayload);
    expect(result).to.eql(mockRow);
  });

  it('delegates getById', async () => {
    const service = new SubmissionFeaturePropertyCodeService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyCodeRepository.prototype, 'getSubmissionFeaturePropertyCodeById')
      .resolves(mockRow);

    const result = await service.getSubmissionFeaturePropertyCodeById(1);

    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getBySubmissionFeatureId', async () => {
    const service = new SubmissionFeaturePropertyCodeService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyCodeRepository.prototype, 'getSubmissionFeaturePropertyCodesBySubmissionFeatureId')
      .resolves([mockRow]);

    const result = await service.getSubmissionFeaturePropertyCodesBySubmissionFeatureId(10);

    expect(stub).to.have.been.calledOnceWith(10);
    expect(result).to.eql([mockRow]);
  });

  it('delegates getByFeatureTypePropertyId', async () => {
    const service = new SubmissionFeaturePropertyCodeService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyCodeRepository.prototype,
        'getSubmissionFeaturePropertyCodesByFeatureTypePropertyId'
      )
      .resolves([mockRow]);

    const result = await service.getSubmissionFeaturePropertyCodesByFeatureTypePropertyId(20);

    expect(stub).to.have.been.calledOnceWith(20);
    expect(result).to.eql([mockRow]);
  });

  it('delegates getByContributorCodesetCodeId', async () => {
    const service = new SubmissionFeaturePropertyCodeService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyCodeRepository.prototype,
        'getSubmissionFeaturePropertyCodesByContributorCodesetCodeId'
      )
      .resolves([mockRow]);

    const result = await service.getSubmissionFeaturePropertyCodesByContributorCodesetCodeId(30);

    expect(stub).to.have.been.calledOnceWith(30);
    expect(result).to.eql([mockRow]);
  });

  it('propagates repository errors', async () => {
    const service = new SubmissionFeaturePropertyCodeService(getMockDBConnection());
    sinon
      .stub(SubmissionFeaturePropertyCodeRepository.prototype, 'insertSubmissionFeaturePropertyCode')
      .rejects(new Error('DB error'));

    try {
      await service.createSubmissionFeaturePropertyCode(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
