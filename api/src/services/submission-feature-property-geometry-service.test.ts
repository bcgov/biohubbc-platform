import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import {
  CreateSubmissionFeaturePropertyGeometry,
  SubmissionFeaturePropertyGeometry
} from '../models/submission-feature-property-geometry';
import { SubmissionFeaturePropertyGeometryRepository } from '../repositories/submission-feature-property-geometry-repository';
import { SubmissionFeatureRepository } from '../repositories/submission-feature-repository';
import { SubmissionFeaturePropertyGeometryService } from './submission-feature-property-geometry-service';

chai.use(sinonChai);

describe('SubmissionFeaturePropertyGeometryService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyGeometry = {
    submission_feature_property_geometry_id: 1,
    submission_feature_id: 10,
    blueprint_feature_type_property_id: 20,
    value: {
      type: 'Point',
      coordinates: [-123.1, 49.2]
    }
  };

  const createPayload: CreateSubmissionFeaturePropertyGeometry = {
    submission_feature_id: 10,
    blueprint_feature_type_property_id: 20,
    value: mockRow.value
  };
  it('delegates create', async () => {
    const service = new SubmissionFeaturePropertyGeometryService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyGeometryRepository.prototype, 'insertSubmissionFeaturePropertyGeometry')
      .resolves(mockRow);
    const result = await service.createSubmissionFeaturePropertyGeometry(createPayload);
    expect(stub).to.have.been.calledOnceWith(createPayload);
    expect(result).to.eql(mockRow);
  });

  it('delegates getById', async () => {
    const service = new SubmissionFeaturePropertyGeometryService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyGeometryRepository.prototype, 'getSubmissionFeaturePropertyGeometryById')
      .resolves(mockRow);
    const result = await service.getSubmissionFeaturePropertyGeometryById(1);
    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getBySubmissionFeatureId', async () => {
    const service = new SubmissionFeaturePropertyGeometryService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyGeometryRepository.prototype,
        'getSubmissionFeaturePropertyGeometryBySubmissionFeatureId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyGeometryBySubmissionFeatureId(10);
    expect(stub).to.have.been.calledOnceWith(10);
    expect(result).to.eql([mockRow]);
  });
  it("frames a feature by id with the extent of the feature's own submission", async () => {
    const service = new SubmissionFeaturePropertyGeometryService(getMockDBConnection());
    const extent = { bbox: [-125.1, 49.1, -125.0, 49.2] as [number, number, number, number], geometry_count: 2 };
    const featureStub = sinon
      .stub(SubmissionFeatureRepository.prototype, 'getSubmissionFeatureById')
      .resolves({ submission_feature_id: 34, submission_id: 12 } as any);
    const extentStub = sinon
      .stub(SubmissionFeaturePropertyGeometryRepository.prototype, 'getActiveGeometryExtent')
      .resolves(extent);

    const result = await service.getActiveGeometryExtentBySubmissionFeatureId(34);

    expect(featureStub).to.have.been.calledOnceWithExactly(34);
    expect(extentStub).to.have.been.calledOnceWithExactly(12, 34);
    expect(result).to.eql({ submissionId: 12, ...extent });
  });
  it('delegates getSubmissionUploadGeometryExtent', async () => {
    const service = new SubmissionFeaturePropertyGeometryService(getMockDBConnection());
    const extent = { bbox: [-125.1, 49.1, -125.0, 49.2] as [number, number, number, number], geometry_count: 3 };
    const stub = sinon
      .stub(SubmissionFeaturePropertyGeometryRepository.prototype, 'getSubmissionUploadGeometryExtent')
      .resolves(extent);
    const result = await service.getSubmissionUploadGeometryExtent(12, '11111111-1111-4111-8111-111111111111', 'new');
    expect(stub).to.have.been.calledOnceWith(12, '11111111-1111-4111-8111-111111111111', 'new');
    expect(result).to.eql(extent);
  });
  it('propagates repository errors', async () => {
    const service = new SubmissionFeaturePropertyGeometryService(getMockDBConnection());
    sinon
      .stub(SubmissionFeaturePropertyGeometryRepository.prototype, 'insertSubmissionFeaturePropertyGeometry')
      .rejects(new Error('DB error'));

    try {
      await service.createSubmissionFeaturePropertyGeometry(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
