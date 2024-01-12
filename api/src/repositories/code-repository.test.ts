import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { CodeRepository, IAllCodeSets, ICode } from './code-repository';

chai.use(sinonChai);

describe('CodeRepository', () => {
  describe('getFeatureTypes', async () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return rows if succeeds', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ id: 1, name: 'name' } as unknown as ICode]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const codeRepository = new CodeRepository(mockDBConnection);

      const result = await codeRepository.getFeatureTypes();

      expect(result).to.be.eql([{ id: 1, name: 'name' }]);
    });
  });

  describe('getFeatureTypePropertyCodes', async () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return rows if succeeds', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            id: 1,
            name: 'name',
            display_name: 'display',
            type: 'string'
          } as unknown as IAllCodeSets['feature_type_with_properties']
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const codeRepository = new CodeRepository(mockDBConnection);

      const result = await codeRepository.getFeatureTypePropertyCodes();

      expect(result).to.be.eql([{ id: 1, name: 'name', display_name: 'display', type: 'string' }]);
    });
  });
});
