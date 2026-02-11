import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { FeatureProperty, FeatureTypeWithProperties, FeatureTypeWithPropertiesRow } from '../models/feature-type';
import { getMockDBConnection } from '../__mocks__/db';
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
      const mockQueryResponse = mockQueryResult<FeatureProperty>([], 0);

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
      const mockData: FeatureProperty[] = [
        {
          name: 'dataset',
          display_name: 'Dataset',
          description: 'asd',
          type_name: 'string',
          required_value: true,
          calculated_value: false
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

  describe('getFeatureTypeWithProperties', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return feature type with properties when valid', async () => {
      // Type mock data with Zod-inferred type - TypeScript will catch field name errors
      const mockRows: FeatureTypeWithPropertiesRow[] = [
        {
          feature_type_id: 1,
          name: 'dataset',
          display_name: 'Dataset',
          property_name: 'name',
          property_display_name: 'Name',
          property_description: 'The name of the dataset',
          property_type_name: 'string',
          required_value: true,
          calculated_value: false
        },
        {
          feature_type_id: 1,
          name: 'dataset',
          display_name: 'Dataset',
          property_name: 'description',
          property_display_name: 'Description',
          property_description: 'The description of the dataset',
          property_type_name: 'string',
          required_value: false,
          calculated_value: false
        }
      ];
      const mockQueryResponse = mockQueryResult(mockRows);

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const validationRepository = new ValidationRepository(mockDBConnection);
      const response = await validationRepository.getFeatureTypeWithProperties('dataset');

      // Type expected response with Zod-inferred type
      const expectedResponse: FeatureTypeWithProperties = {
        featureType: {
          feature_type_id: 1,
          name: 'dataset',
          display_name: 'Dataset'
        },
        properties: [
          {
            name: 'name',
            display_name: 'Name',
            description: 'The name of the dataset',
            type_name: 'string',
            required_value: true,
            calculated_value: false
          },
          {
            name: 'description',
            display_name: 'Description',
            description: 'The description of the dataset',
            type_name: 'string',
            required_value: false,
            calculated_value: false
          }
        ]
      };

      expect(response).to.eql(expectedResponse);
    });

    it('should return null when feature type does not exist', async () => {
      const mockQueryResponse = mockQueryResult<FeatureTypeWithPropertiesRow>([], 0);

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const validationRepository = new ValidationRepository(mockDBConnection);
      const response = await validationRepository.getFeatureTypeWithProperties('nonexistent_type');

      expect(response).to.be.null;
    });

    it('should return empty properties array when type has no properties', async () => {
      // Type mock data with Zod-inferred type
      const mockRows: FeatureTypeWithPropertiesRow[] = [
        {
          feature_type_id: 99,
          name: 'empty_type',
          display_name: 'Empty Type',
          property_name: null,
          property_display_name: null,
          property_description: null,
          property_type_name: null,
          required_value: null,
          calculated_value: null
        }
      ];
      const mockQueryResponse = mockQueryResult(mockRows);

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const validationRepository = new ValidationRepository(mockDBConnection);
      const response = await validationRepository.getFeatureTypeWithProperties('empty_type');

      const expectedResponse: FeatureTypeWithProperties = {
        featureType: {
          feature_type_id: 99,
          name: 'empty_type',
          display_name: 'Empty Type'
        },
        properties: []
      };

      expect(response).to.eql(expectedResponse);
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
