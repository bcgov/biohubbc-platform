import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { SubmissionFeaturePropertyArtifact } from '../models/submission-feature-property-artifact';
import { SubmissionFeaturePropertyArtifactRepository } from './submission-feature-property-artifact-repository';

describe('SubmissionFeaturePropertyArtifactRepository', () => {
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

  describe('insert', () => {
    it('returns inserted row', async () => {
      const repository = new SubmissionFeaturePropertyArtifactRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.insertSubmissionFeaturePropertyArtifact({
        submission_feature_id: 10,
        feature_type_property_id: 20,
        blueprint_feature_type_property_id: 30,
        artifact_id: artifactId
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const repository = new SubmissionFeaturePropertyArtifactRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.insertSubmissionFeaturePropertyArtifact({
          submission_feature_id: 10,
          feature_type_property_id: 20,
          blueprint_feature_type_property_id: 30,
          artifact_id: artifactId
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('getById', () => {
    it('returns row', async () => {
      const repository = new SubmissionFeaturePropertyArtifactRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyArtifactById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const repository = new SubmissionFeaturePropertyArtifactRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.getSubmissionFeaturePropertyArtifactById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const repository = new SubmissionFeaturePropertyArtifactRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) })
      );

      try {
        await repository.getSubmissionFeaturePropertyArtifactById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by submission_feature_id', async () => {
      const repository = new SubmissionFeaturePropertyArtifactRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyArtifactsBySubmissionFeatureId(10);
      expect(result).to.eql([mockRow]);
    });

    it('lists by feature_type_property_id', async () => {
      const repository = new SubmissionFeaturePropertyArtifactRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyArtifactsByFeatureTypePropertyId(20);
      expect(result).to.eql([mockRow]);
    });

    it('lists by artifact_id', async () => {
      const repository = new SubmissionFeaturePropertyArtifactRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyArtifactsByArtifactId(artifactId);
      expect(result).to.eql([mockRow]);
    });
  });
});
