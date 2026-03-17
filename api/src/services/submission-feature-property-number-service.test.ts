import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  CreateSubmissionFeaturePropertyNumber,
  SubmissionFeaturePropertyNumber
} from '../models/submission-feature-property-number';
import { SubmissionFeaturePropertyNumberRepository } from '../repositories/submission-feature-property-number-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionFeaturePropertyNumberService } from './submission-feature-property-number-service';

chai.use(sinonChai);

describe('SubmissionFeaturePropertyNumberService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyNumber = {
    submission_feature_property_number_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: 12
  };

  const createPayload: CreateSubmissionFeaturePropertyNumber = {
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: 12
  };
  it('delegates create', async () => {
    const service = new SubmissionFeaturePropertyNumberService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyNumberRepository.prototype, 'insertSubmissionFeaturePropertyNumber')
      .resolves(mockRow);
    const result = await service.createSubmissionFeaturePropertyNumber(createPayload);
    expect(stub).to.have.been.calledOnceWith(createPayload);
    expect(result).to.eql(mockRow);
  });

  it('delegates getById', async () => {
    const service = new SubmissionFeaturePropertyNumberService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyNumberRepository.prototype, 'getSubmissionFeaturePropertyNumberById')
      .resolves(mockRow);
    const result = await service.getSubmissionFeaturePropertyNumberById(1);
    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getBySubmissionFeatureId', async () => {
    const service = new SubmissionFeaturePropertyNumberService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyNumberRepository.prototype,
        'getSubmissionFeaturePropertyNumberBySubmissionFeatureId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyNumberBySubmissionFeatureId(10);
    expect(stub).to.have.been.calledOnceWith(10);
    expect(result).to.eql([mockRow]);
  });

  it('delegates getByFeatureTypePropertyId', async () => {
    const service = new SubmissionFeaturePropertyNumberService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyNumberRepository.prototype,
        'getSubmissionFeaturePropertyNumberByFeatureTypePropertyId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyNumberByFeatureTypePropertyId(20);
    expect(stub).to.have.been.calledOnceWith(20);
    expect(result).to.eql([mockRow]);
  });
  it('propagates repository errors', async () => {
    const service = new SubmissionFeaturePropertyNumberService(getMockDBConnection());
    sinon
      .stub(SubmissionFeaturePropertyNumberRepository.prototype, 'insertSubmissionFeaturePropertyNumber')
      .rejects(new Error('DB error'));

    try {
      await service.createSubmissionFeaturePropertyNumber(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
