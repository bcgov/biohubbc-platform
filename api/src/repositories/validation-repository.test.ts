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
