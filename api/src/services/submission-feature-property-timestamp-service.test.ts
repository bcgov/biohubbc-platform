import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  CreateSubmissionFeaturePropertyTimestamp,
  SubmissionFeaturePropertyTimestamp
} from '../models/submission-feature-property-timestamp';
import { SubmissionFeaturePropertyTimestampRepository } from '../repositories/submission-feature-property-timestamp-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionFeaturePropertyTimestampService } from './submission-feature-property-timestamp-service';

chai.use(sinonChai);

describe('SubmissionFeaturePropertyTimestampService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyTimestamp = {
    submission_feature_property_timestamp_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    date_value: '2026-01-01',
    time_value: '00:00:00'
  };

  const createPayload: CreateSubmissionFeaturePropertyTimestamp = {
    submission_feature_id: 10,
    feature_type_property_id: 20,
    date_value: '2026-01-01',
    time_value: '00:00:00'
  };
  it('delegates create', async () => {
    const service = new SubmissionFeaturePropertyTimestampService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyTimestampRepository.prototype, 'insertSubmissionFeaturePropertyTimestamp')
      .resolves(mockRow);
    const result = await service.createSubmissionFeaturePropertyTimestamp(createPayload);
    expect(stub).to.have.been.calledOnceWith(createPayload);
    expect(result).to.eql(mockRow);
  });

  it('delegates getById', async () => {
    const service = new SubmissionFeaturePropertyTimestampService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyTimestampRepository.prototype, 'getSubmissionFeaturePropertyTimestampById')
      .resolves(mockRow);
    const result = await service.getSubmissionFeaturePropertyTimestampById(1);
    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getBySubmissionFeatureId', async () => {
    const service = new SubmissionFeaturePropertyTimestampService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyTimestampRepository.prototype,
        'getSubmissionFeaturePropertyTimestampBySubmissionFeatureId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyTimestampBySubmissionFeatureId(10);
    expect(stub).to.have.been.calledOnceWith(10);
    expect(result).to.eql([mockRow]);
  });

  it('delegates getByFeatureTypePropertyId', async () => {
    const service = new SubmissionFeaturePropertyTimestampService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyTimestampRepository.prototype,
        'getSubmissionFeaturePropertyTimestampByFeatureTypePropertyId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyTimestampByFeatureTypePropertyId(20);
    expect(stub).to.have.been.calledOnceWith(20);
    expect(result).to.eql([mockRow]);
  });
  it('propagates repository errors', async () => {
    const service = new SubmissionFeaturePropertyTimestampService(getMockDBConnection());
    sinon
      .stub(SubmissionFeaturePropertyTimestampRepository.prototype, 'insertSubmissionFeaturePropertyTimestamp')
      .rejects(new Error('DB error'));

    try {
      await service.createSubmissionFeaturePropertyTimestamp(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
