import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiGeneralError } from '../errors/api-error';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { IInsertStyleSchema, IStyleModel, ValidationRepository } from './validation-repository';

chai.use(sinonChai);

/**
 * Helper to create a properly typed QueryResult for mock responses.
 * Type the rows parameter to get compile-time field validation,
 * but return QueryResult<any> to satisfy the mock DB connection signature.
 */
function mockQueryResult<T>(rows: T[], rowCount?: number): QueryResult<any> {
  return {
    rowCount: rowCount ?? rows.length,
    rows,
    command: '',
    oid: 0,
    fields: []
  };
}

describe('ValidationRepository', () => {
  describe('getFeatureValidationProperties', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when select sql fails', async () => {
      const mockQueryResponse = mockQueryResult<FeatureTypeProperty>([], 0);

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const validationRepository = new ValidationRepository(mockDBConnection);
      const featureType = 'type';

      try {
        await validationRepository.getFeatureValidationProperties(featureType);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal(
          `Failed to get validation properties for feature type: ${featureType}`
        );
      }
    });

    it('should succeed with valid data', async () => {
      // Type mock data with Zod-inferred type - TypeScript will catch field name errors
      const mockData: FeatureTypeProperty[] = [
        {
          feature_type_property_id: 1,
          name: 'dataset',
          display_name: 'Dataset',
          description: 'asd',
          type_name: 'string',
          required_value: true,
          calculated_value: false,
          allow_multiple: false
        }
      ];
      const mockQueryResponse = mockQueryResult(mockData);

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const validationRepository = new ValidationRepository(mockDBConnection);
      const response = await validationRepository.getFeatureValidationProperties('type');

      // Reuse typed mock data in assertion
      expect(response).to.eql(mockData);
    });
  });

  describe('insertStyleSchema', () => {
    afterEach(() => {
      sinon.restore();
    });

    const mockParams: IInsertStyleSchema = { something: 'thing' };

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = mockQueryResult<{ style_id: number }>([], 0);

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const validationRepository = new ValidationRepository(mockDBConnection);

      try {
        await validationRepository.insertStyleSchema(mockParams);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert style schema');
      }
    });

    it('should succeed with valid data', async () => {
      const mockData = [{ style_id: 1 }];
      const mockQueryResponse = mockQueryResult(mockData);

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const validationRepository = new ValidationRepository(mockDBConnection);
      const response = await validationRepository.insertStyleSchema(mockParams);

      expect(response.style_id).to.equal(1);
    });
  });

  describe('getStyleSchemaByStyleId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when select sql fails', async () => {
      const mockQueryResponse = mockQueryResult<IStyleModel>([], 0);

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const validationRepository = new ValidationRepository(mockDBConnection);

      try {
        await validationRepository.getStyleSchemaByStyleId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get style schema');
      }
    });

    it('should succeed with valid data', async () => {
      const mockData: IStyleModel[] = [{ something: 'thing' }];
      const mockQueryResponse = mockQueryResult(mockData);

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const validationRepository = new ValidationRepository(mockDBConnection);
      const response = await validationRepository.getStyleSchemaByStyleId(1);

      expect(response).to.eql(mockData[0]);
    });
  });
});
