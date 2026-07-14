import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import {
  CreateSubmissionFeaturePropertyArtifact,
  SubmissionFeaturePropertyArtifact
} from '../models/submission-feature-property-artifact';
import { SubmissionFeaturePropertyArtifactRepository } from '../repositories/submission-feature-property-artifact-repository';
import { SubmissionFeaturePropertyArtifactService } from './submission-feature-property-artifact-service';

chai.use(sinonChai);

describe('SubmissionFeaturePropertyArtifactService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const artifactId = '550e8400-e29b-41d4-a716-446655440000';

  const mockRow: SubmissionFeaturePropertyArtifact = {
    submission_feature_property_artifact_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    blueprint_feature_type_property_id: 30,
    artifact_id: artifactId
  };

  const createPayload: CreateSubmissionFeaturePropertyArtifact = {
    submission_feature_id: 10,
    feature_type_property_id: 20,
    blueprint_feature_type_property_id: 30,
    artifact_id: artifactId
  };

  it('delegates create', async () => {
    const service = new SubmissionFeaturePropertyArtifactService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyArtifactRepository.prototype, 'insertSubmissionFeaturePropertyArtifact')
      .resolves(mockRow);

    const result = await service.createSubmissionFeaturePropertyArtifact(createPayload);

    expect(stub).to.have.been.calledOnceWith(createPayload);
    expect(result).to.eql(mockRow);
  });

  it('delegates getById', async () => {
    const service = new SubmissionFeaturePropertyArtifactService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyArtifactRepository.prototype, 'getSubmissionFeaturePropertyArtifactById')
      .resolves(mockRow);

    const result = await service.getSubmissionFeaturePropertyArtifactById(1);

    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getBySubmissionFeatureId', async () => {
    const service = new SubmissionFeaturePropertyArtifactService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyArtifactRepository.prototype,
        'getSubmissionFeaturePropertyArtifactsBySubmissionFeatureId'
      )
      .resolves([mockRow]);

    const result = await service.getSubmissionFeaturePropertyArtifactsBySubmissionFeatureId(10);

    expect(stub).to.have.been.calledOnceWith(10);
    expect(result).to.eql([mockRow]);
  });

  it('delegates getByFeatureTypePropertyId', async () => {
    const service = new SubmissionFeaturePropertyArtifactService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyArtifactRepository.prototype,
        'getSubmissionFeaturePropertyArtifactsByFeatureTypePropertyId'
      )
      .resolves([mockRow]);

    const result = await service.getSubmissionFeaturePropertyArtifactsByFeatureTypePropertyId(20);

    expect(stub).to.have.been.calledOnceWith(20);
    expect(result).to.eql([mockRow]);
  });

  it('delegates getByArtifactId', async () => {
    const service = new SubmissionFeaturePropertyArtifactService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyArtifactRepository.prototype, 'getSubmissionFeaturePropertyArtifactsByArtifactId')
      .resolves([mockRow]);

    const result = await service.getSubmissionFeaturePropertyArtifactsByArtifactId(artifactId);

    expect(stub).to.have.been.calledOnceWith(artifactId);
    expect(result).to.eql([mockRow]);
  });

  it('propagates repository errors', async () => {
    const service = new SubmissionFeaturePropertyArtifactService(getMockDBConnection());
    sinon
      .stub(SubmissionFeaturePropertyArtifactRepository.prototype, 'insertSubmissionFeaturePropertyArtifact')
      .rejects(new Error('DB error'));

    try {
      await service.createSubmissionFeaturePropertyArtifact(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
