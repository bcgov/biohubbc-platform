import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ISystemConstant, SystemConstantRepository } from './system-constant-repository';

chai.use(sinonChai);

describe('SystemConstantRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getSystemConstants', () => {
    it('should return array of system constants', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [{ system_constant_id: 1 }, { system_constant_id: 1 }] as unknown as ISystemConstant[]
      } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const systemConstantRepository = new SystemConstantRepository(mockDBConnection);

      const response = await systemConstantRepository.getSystemConstants(['constant_name_1', 'constant_name_2']);

      expect(response).to.be.eql([{ system_constant_id: 1 }, { system_constant_id: 1 }]);
    });
  });
});
