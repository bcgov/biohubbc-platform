import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { FeatureProperty, UpdateFeatureProperty } from '../models/feature-property';
import { FeaturePropertyRepository } from './feature-property-repository';

chai.use(sinonChai);

const mockFeatureProperty: FeatureProperty = {
  feature_property_id: 1,
  feature_property_type_id: 2,
  name: 'guid',
  display_name: 'GUID',
  description: null,
  type_name: 'string',
  calculated_value: false
};

describe('FeaturePropertyRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getSubmissionUploadFeatureTypeProperties', () => {
    it('reads unique definitions using submission, upload, and type boundaries in one query', async () => {
      const execute = sinon.stub().resolves({ rows: [mockFeatureProperty] });
      const repository = new FeaturePropertyRepository(getMockDBConnection({ sql: execute }));
      const result = await repository.getSubmissionUploadFeatureTypeProperties(16, 'upload-id', 'animal');
      expect(result).to.deep.equal([mockFeatureProperty]);
      expect(execute).to.have.been.calledOnce;
      const query = execute.firstCall.args[0];
      expect(query.values).to.deep.equal([16, 'upload-id', 'animal']);
      expect(query.text).to.include('SELECT DISTINCT fp.feature_property_id');
      expect(query.text).to.include('sf.submission_id =');
      expect(query.text).to.include('sf.submission_upload_id =');
      expect(query.text).to.include('ft.name =');
      expect(query.text).not.to.include('reconciliation');
      expect(query.text).not.to.include('record_end_date');
      expect(query.text).not.to.include('submission_feature_closure');
      expect(query.text).to.include('submission_feature_property_artifact');
      expect(query.text).to.include('submission_feature_property_feature');
    });

    it('returns an empty set when the upload has no properties for that type', async () => {
      const repository = new FeaturePropertyRepository(
        getMockDBConnection({ sql: sinon.stub().resolves({ rows: [] }) })
      );
      expect(await repository.getSubmissionUploadFeatureTypeProperties(16, 'upload-id', 'animal')).to.deep.equal([]);
    });
  });

  describe('getExpressionPredicatePropertyMetadata', () => {
    for (const assignmentId of [null, 12]) {
      it(`retains retired definitions when resolving assignment ${assignmentId}`, async () => {
        const execute = sinon.stub().resolves({ rowCount: 1, rows: [{ feature_property_id: 7 }] });
        const repository = new FeaturePropertyRepository(getMockDBConnection({ sql: execute }));
        await repository.getExpressionPredicatePropertyMetadata(7, assignmentId);
        expect(execute).to.have.been.calledOnce;
        const query = execute.firstCall.args[0];
        expect(query.text).not.to.include('record_end_date');
        expect(query.values).to.include(7);
        if (assignmentId !== null) {
          expect(query.values).to.include(assignmentId);
        }
      });
    }
  });

  describe('getFeaturePropertyTypeById', () => {
    it('returns the feature property type record when found', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ feature_property_type_id: 2 }]
      } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeaturePropertyRepository(mockConnection);

      const result = await repository.getFeaturePropertyTypeById(2);
      expect(result).to.eql({ feature_property_type_id: 2 });
    });

    it('throws ApiNotFoundError when no active type exists for the given ID', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeaturePropertyRepository(mockConnection);

      try {
        await repository.getFeaturePropertyTypeById(999);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('insertFeatureProperty', () => {
    it('returns the new feature_property_id', async () => {
      const mockResponse = { rowCount: 1, rows: [{ feature_property_id: 1 }] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeaturePropertyRepository(mockConnection);

      const result = await repository.insertFeatureProperty({
        feature_property_type_id: 2,
        name: 'guid',
        display_name: 'GUID'
      });

      expect(result).to.equal(1);
    });
  });

  describe('getFeatureProperty', () => {
    it('returns a feature property by ID', async () => {
      const mockResponse = { rowCount: 1, rows: [mockFeatureProperty] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeaturePropertyRepository(mockConnection);

      const result = await repository.getFeatureProperty(1);
      expect(result).to.eql(mockFeatureProperty);
    });

    it('throws ApiNotFoundError when not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeaturePropertyRepository(mockConnection);

      try {
        await repository.getFeatureProperty(999);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('updateFeatureProperty', () => {
    it('ignores feature_property_type_id even if it is present at runtime', async () => {
      const mockResponse = { rowCount: 1, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({
        knex: async (query) => {
          const statement = query.toSQL().toNative();

          expect(statement.sql).not.to.include('feature_property_type_id');
          expect(statement.bindings).not.to.include(3);

          return mockResponse;
        }
      });
      const repository = new FeaturePropertyRepository(mockConnection);
      const runtimePayload = {
        display_name: 'Updated',
        feature_property_type_id: 3
      } as UpdateFeatureProperty & { feature_property_type_id: number };

      await repository.updateFeatureProperty(1, runtimePayload);
    });

    it('throws when no active row is updated', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeaturePropertyRepository(mockConnection);

      try {
        await repository.updateFeatureProperty(999, { display_name: 'Updated' });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update feature property');
      }
    });
  });
});
