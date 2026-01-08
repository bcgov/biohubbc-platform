import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { IInsertStyleSchema, ValidationRepository } from './validation-repository';

chai.use(sinonChai);

describe('ValidationRepository', () => {
  describe('getFeatureValidationProperties', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when select sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
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
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ name: 'dataset', display_name: 'Dataset', description: 'asd', type: 'string' }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const validationRepository = new ValidationRepository(mockDBConnection);

      const response = await validationRepository.getFeatureValidationProperties('type');

      expect(response).to.eql([{ name: 'dataset', display_name: 'Dataset', description: 'asd', type: 'string' }]);
    });
  });

  describe('getFeatureTypeWithProperties', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return feature type with properties when valid', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [
          {
            feature_type_id: 1,
            name: 'dataset',
            display_name: 'Dataset',
            property_name: 'name',
            property_display_name: 'Name',
            property_description: 'The name of the dataset',
            property_type_name: 'string',
            required_value: true
          },
          {
            feature_type_id: 1,
            name: 'dataset',
            display_name: 'Dataset',
            property_name: 'description',
            property_display_name: 'Description',
            property_description: 'The description of the dataset',
            property_type_name: 'string',
            required_value: false
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const validationRepository = new ValidationRepository(mockDBConnection);

      const response = await validationRepository.getFeatureTypeWithProperties('dataset');

      expect(response).to.eql({
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
            required_value: true
          },
          {
            name: 'description',
            display_name: 'Description',
            description: 'The description of the dataset',
            type_name: 'string',
            required_value: false
          }
        ]
      });
    });

    it('should return null when feature type does not exist', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const validationRepository = new ValidationRepository(mockDBConnection);

      const response = await validationRepository.getFeatureTypeWithProperties('nonexistent_type');

      expect(response).to.be.null;
    });

    it('should return empty properties array when type has no properties', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            feature_type_id: 99,
            name: 'empty_type',
            display_name: 'Empty Type',
            property_name: null,
            property_display_name: null,
            property_description: null,
            property_type_name: null,
            required_value: null
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const validationRepository = new ValidationRepository(mockDBConnection);

      const response = await validationRepository.getFeatureTypeWithProperties('empty_type');

      expect(response).to.eql({
        featureType: {
          feature_type_id: 99,
          name: 'empty_type',
          display_name: 'Empty Type'
        },
        properties: []
      });
    });
  });

  describe('insertStyleSchema', () => {
    afterEach(() => {
      sinon.restore();
    });

    const mockParams = { something: 'thing' };

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const validationRepository = new ValidationRepository(mockDBConnection);

      try {
        await validationRepository.insertStyleSchema(mockParams as unknown as IInsertStyleSchema);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert style schema');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ style_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const validationRepository = new ValidationRepository(mockDBConnection);

      const response = await validationRepository.insertStyleSchema(mockParams as unknown as IInsertStyleSchema);

      expect(response.style_id).to.equal(1);
    });
  });

  describe('getStyleSchemaByStyleId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
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
      const mockResponse = { something: 'thing' };
      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const validationRepository = new ValidationRepository(mockDBConnection);

      const response = await validationRepository.getStyleSchemaByStyleId(1);

      expect(response).to.eql(mockResponse);
    });
  });
});
