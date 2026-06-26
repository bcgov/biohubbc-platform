import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { SubmissionFeaturePropertyGeometry } from '../models/submission-feature-property-geometry';
import { SubmissionFeaturePropertyGeometryRepository } from './submission-feature-property-geometry-repository';

describe('SubmissionFeaturePropertyGeometryRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockGeometry = {
    type: 'Point',
    coordinates: [-123.1, 49.2]
  };

  const mockRow: SubmissionFeaturePropertyGeometry = {
    submission_feature_property_geometry_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: mockGeometry
  };

  describe('insert', () => {
    it('returns inserted row and uses GeoJSON conversion SQL', async () => {
      const sqlStub = sinon.stub().callsFake((statement: any) => {
        expect(statement.text).to.contain('ST_GeomFromGeoJSON');
        expect(statement.text).to.contain('ST_AsGeoJSON');
        return Promise.resolve(mockQueryResult([mockRow]));
      });
      const repository = new SubmissionFeaturePropertyGeometryRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.insertSubmissionFeaturePropertyGeometry({
        submission_feature_id: 10,
        feature_type_property_id: 20,
        value: mockGeometry
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const repository = new SubmissionFeaturePropertyGeometryRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.insertSubmissionFeaturePropertyGeometry({
          submission_feature_id: 10,
          feature_type_property_id: 20,
          value: mockGeometry
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('getById', () => {
    it('returns row', async () => {
      const repository = new SubmissionFeaturePropertyGeometryRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyGeometryById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const repository = new SubmissionFeaturePropertyGeometryRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.getSubmissionFeaturePropertyGeometryById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const repository = new SubmissionFeaturePropertyGeometryRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([mockRow], 2)) })
      );

      try {
        await repository.getSubmissionFeaturePropertyGeometryById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by submission_feature_id', async () => {
      const repository = new SubmissionFeaturePropertyGeometryRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyGeometryBySubmissionFeatureId(10);
      expect(result).to.eql([mockRow]);
    });

    it('lists by feature_type_property_id', async () => {
      const repository = new SubmissionFeaturePropertyGeometryRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyGeometryByFeatureTypePropertyId(20);
      expect(result).to.eql([mockRow]);
    });
  });
});
