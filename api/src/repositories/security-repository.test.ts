import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { IInsertSecuritySchema, SecurityRepository } from './security-repository';
import { IInsertStyleSchema } from './validation-repository';

chai.use(sinonChai);

describe('SecurityRepository', () => {
  describe('insertSecuritySchema', () => {
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

      const securityRepository = new SecurityRepository(mockDBConnection);

      try {
        await securityRepository.insertSecuritySchema(mockParams as unknown as IInsertSecuritySchema);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert security schema');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ security_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const securityRepository = new SecurityRepository(mockDBConnection);

      const response = await securityRepository.insertSecuritySchema(mockParams as unknown as IInsertStyleSchema);

      expect(response.security_id).to.equal(1);
    });
  });

  describe('getSecuritySchemaBySecurityId', () => {
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

      const securityRepository = new SecurityRepository(mockDBConnection);

      try {
        await securityRepository.getSecuritySchemaBySecurityId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get security schema');
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

      const securityRepository = new SecurityRepository(mockDBConnection);

      const response = await securityRepository.getSecuritySchemaBySecurityId(1);

      expect(response).to.eql(mockResponse);
    });
  });
});
