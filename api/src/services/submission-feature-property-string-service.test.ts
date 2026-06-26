import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import {
  CreateSubmissionFeaturePropertyString,
  SubmissionFeaturePropertyString
} from '../models/submission-feature-property-string';
import { SubmissionFeaturePropertyStringRepository } from '../repositories/submission-feature-property-string-repository';
import { SubmissionFeaturePropertyStringService } from './submission-feature-property-string-service';

chai.use(sinonChai);

describe('SubmissionFeaturePropertyStringService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyString = {
    submission_feature_property_string_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: 'alpha'
  };

  const createPayload: CreateSubmissionFeaturePropertyString = {
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: 'alpha'
  };
  it('delegates create', async () => {
    const service = new SubmissionFeaturePropertyStringService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyStringRepository.prototype, 'insertSubmissionFeaturePropertyString')
      .resolves(mockRow);
    const result = await service.createSubmissionFeaturePropertyString(createPayload);
    expect(stub).to.have.been.calledOnceWith(createPayload);
    expect(result).to.eql(mockRow);
  });

  it('delegates getById', async () => {
    const service = new SubmissionFeaturePropertyStringService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyStringRepository.prototype, 'getSubmissionFeaturePropertyStringById')
      .resolves(mockRow);
    const result = await service.getSubmissionFeaturePropertyStringById(1);
    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getBySubmissionFeatureId', async () => {
    const service = new SubmissionFeaturePropertyStringService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyStringRepository.prototype,
        'getSubmissionFeaturePropertyStringBySubmissionFeatureId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyStringBySubmissionFeatureId(10);
    expect(stub).to.have.been.calledOnceWith(10);
    expect(result).to.eql([mockRow]);
  });

  it('delegates getByFeatureTypePropertyId', async () => {
    const service = new SubmissionFeaturePropertyStringService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyStringRepository.prototype,
        'getSubmissionFeaturePropertyStringByFeatureTypePropertyId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyStringByFeatureTypePropertyId(20);
    expect(stub).to.have.been.calledOnceWith(20);
    expect(result).to.eql([mockRow]);
  });
  it('propagates repository errors', async () => {
    const service = new SubmissionFeaturePropertyStringService(getMockDBConnection());
    sinon
      .stub(SubmissionFeaturePropertyStringRepository.prototype, 'insertSubmissionFeaturePropertyString')
      .rejects(new Error('DB error'));

    try {
      await service.createSubmissionFeaturePropertyString(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
