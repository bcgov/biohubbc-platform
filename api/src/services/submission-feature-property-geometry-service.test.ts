import chai, { expect } from 'chai';
import { Feature } from 'geojson';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  CreateSubmissionFeaturePropertyGeometry,
  SubmissionFeaturePropertyGeometry
} from '../models/submission-feature-property-geometry';
import { SubmissionFeaturePropertyGeometryRepository } from '../repositories/submission-feature-property-geometry-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionFeaturePropertyGeometryService } from './submission-feature-property-geometry-service';

chai.use(sinonChai);

describe('SubmissionFeaturePropertyGeometryService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockGeometry: Feature = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [-123.1, 49.2]
    },
    properties: {}
  };

  const mockRow: SubmissionFeaturePropertyGeometry = {
    submission_feature_property_geometry_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: mockGeometry
  };

  const createPayload: CreateSubmissionFeaturePropertyGeometry = {
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: mockGeometry
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

  it('delegates getByFeatureTypePropertyId', async () => {
    const service = new SubmissionFeaturePropertyGeometryService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyGeometryRepository.prototype,
        'getSubmissionFeaturePropertyGeometryByFeatureTypePropertyId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyGeometryByFeatureTypePropertyId(20);
    expect(stub).to.have.been.calledOnceWith(20);
    expect(result).to.eql([mockRow]);
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
