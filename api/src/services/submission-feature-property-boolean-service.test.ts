import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  CreateSubmissionFeaturePropertyBoolean,
  SubmissionFeaturePropertyBoolean
} from '../models/submission-feature-property-boolean';
import { SubmissionFeaturePropertyBooleanRepository } from '../repositories/submission-feature-property-boolean-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionFeaturePropertyBooleanService } from './submission-feature-property-boolean-service';

chai.use(sinonChai);

describe('SubmissionFeaturePropertyBooleanService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyBoolean = {
    submission_feature_property_boolean_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: true
  };

  const createPayload: CreateSubmissionFeaturePropertyBoolean = {
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: true
  };
  it('delegates create', async () => {
    const service = new SubmissionFeaturePropertyBooleanService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyBooleanRepository.prototype, 'insertSubmissionFeaturePropertyBoolean')
      .resolves(mockRow);
    const result = await service.createSubmissionFeaturePropertyBoolean(createPayload);
    expect(stub).to.have.been.calledOnceWith(createPayload);
    expect(result).to.eql(mockRow);
  });

  it('delegates getById', async () => {
    const service = new SubmissionFeaturePropertyBooleanService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyBooleanRepository.prototype, 'getSubmissionFeaturePropertyBooleanById')
      .resolves(mockRow);
    const result = await service.getSubmissionFeaturePropertyBooleanById(1);
    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getBySubmissionFeatureId', async () => {
    const service = new SubmissionFeaturePropertyBooleanService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyBooleanRepository.prototype,
        'getSubmissionFeaturePropertyBooleanBySubmissionFeatureId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyBooleanBySubmissionFeatureId(10);
    expect(stub).to.have.been.calledOnceWith(10);
    expect(result).to.eql([mockRow]);
  });

  it('delegates getByFeatureTypePropertyId', async () => {
    const service = new SubmissionFeaturePropertyBooleanService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyBooleanRepository.prototype,
        'getSubmissionFeaturePropertyBooleanByFeatureTypePropertyId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyBooleanByFeatureTypePropertyId(20);
    expect(stub).to.have.been.calledOnceWith(20);
    expect(result).to.eql([mockRow]);
  });
  it('propagates repository errors', async () => {
    const service = new SubmissionFeaturePropertyBooleanService(getMockDBConnection());
    sinon
      .stub(SubmissionFeaturePropertyBooleanRepository.prototype, 'insertSubmissionFeaturePropertyBoolean')
      .rejects(new Error('DB error'));

    try {
      await service.createSubmissionFeaturePropertyBoolean(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
