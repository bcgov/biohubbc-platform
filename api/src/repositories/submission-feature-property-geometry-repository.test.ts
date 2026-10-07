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
    blueprint_feature_type_property_id: 20,
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
        blueprint_feature_type_property_id: 20,
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
          blueprint_feature_type_property_id: 20,
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
  });

  describe('getActiveGeometryExtent', () => {
    it('returns the combined bounds and count', async () => {
      const sqlStub = sinon.stub().callsFake((statement: any) => {
        expect(statement.text).to.contain('ST_Extent');
        // Both identifiers constrain the query, so a feature id from another submission cannot match.
        expect(statement.values).to.eql([12, 34]);
        return Promise.resolve(
          mockQueryResult([{ min_x: -125.1, min_y: 49.1, max_x: -125.0, max_y: 49.2, geometry_count: 3 }])
        );
      });
      const repository = new SubmissionFeaturePropertyGeometryRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.getActiveGeometryExtent(12, 34);

      expect(result).to.eql({ bbox: [-125.1, 49.1, -125.0, 49.2], geometry_count: 3 });
    });

    it('excludes unpublished features and retired property definitions', async () => {
      const sqlStub = sinon.stub().callsFake((statement: any) => {
        expect(statement.text).to.contain('record_effective_date <= now()');
        expect(statement.text).to.contain(
          'bftp.blueprint_feature_type_property_id = g.blueprint_feature_type_property_id'
        );
        expect(statement.text).to.contain('fp.record_end_date IS NULL');
        return Promise.resolve(
          mockQueryResult([{ min_x: null, min_y: null, max_x: null, max_y: null, geometry_count: 0 }])
        );
      });
      const repository = new SubmissionFeaturePropertyGeometryRepository(getMockDBConnection({ sql: sqlStub }));

      await repository.getActiveGeometryExtent(12, 34);
    });

    it('returns null bounds when the feature has no published spatial properties', async () => {
      const repository = new SubmissionFeaturePropertyGeometryRepository(
        getMockDBConnection({
          sql: () =>
            Promise.resolve(
              mockQueryResult([{ min_x: null, min_y: null, max_x: null, max_y: null, geometry_count: 0 }])
            )
        })
      );

      const result = await repository.getActiveGeometryExtent(12, 34);

      expect(result).to.eql({ bbox: null, geometry_count: 0 });
    });
  });

  describe('getSubmissionUploadGeometryExtent', () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';

    it('returns the combined bounds and count', async () => {
      const sqlStub = sinon.stub().callsFake((statement: any) => {
        expect(statement.text).to.contain('ST_Extent');
        // Both identifiers constrain the query, so an upload id from another submission cannot match.
        expect(statement.values).to.eql([submissionUploadId, 12]);
        return Promise.resolve(
          mockQueryResult([{ min_x: -125.1, min_y: 49.1, max_x: -125.0, max_y: 49.2, geometry_count: 3 }])
        );
      });
      const repository = new SubmissionFeaturePropertyGeometryRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.getSubmissionUploadGeometryExtent(12, submissionUploadId);

      expect(result).to.eql({ bbox: [-125.1, 49.1, -125.0, 49.2], geometry_count: 3 });
    });

    it('includes pending features and excludes ended features and retired property definitions', async () => {
      const sqlStub = sinon.stub().callsFake((statement: any) => {
        expect(statement.text).to.contain('sf.submission_upload_id');
        // The partial index form, verbatim.
        expect(statement.text).to.contain('sf.record_end_date IS NULL');
        // Upload features under review have never been published, so the extent must not be
        // published-gated or every review map would open on an empty state.
        expect(statement.text).to.not.contain('record_effective_date');
        expect(statement.text).to.contain(
          'bftp.blueprint_feature_type_property_id = g.blueprint_feature_type_property_id'
        );
        expect(statement.text).to.contain('fp.record_end_date IS NULL');
        return Promise.resolve(
          mockQueryResult([{ min_x: null, min_y: null, max_x: null, max_y: null, geometry_count: 0 }])
        );
      });
      const repository = new SubmissionFeaturePropertyGeometryRepository(getMockDBConnection({ sql: sqlStub }));

      await repository.getSubmissionUploadGeometryExtent(12, submissionUploadId);
    });

    it('returns null bounds when the upload has no active spatial properties', async () => {
      const repository = new SubmissionFeaturePropertyGeometryRepository(
        getMockDBConnection({
          sql: () =>
            Promise.resolve(
              mockQueryResult([{ min_x: null, min_y: null, max_x: null, max_y: null, geometry_count: 0 }])
            )
        })
      );

      const result = await repository.getSubmissionUploadGeometryExtent(12, submissionUploadId);

      expect(result).to.eql({ bbox: null, geometry_count: 0 });
    });
  });
});
