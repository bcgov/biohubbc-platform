import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ISystemConstant, SystemConstantRepository } from '../repositories/system-constant-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SystemConstantService } from './system-constant-service';

chai.use(sinonChai);

describe('SystemConstantService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getSystemConstants', () => {
    it('should return array of system constants', async () => {
      const mockDBConnection = getMockDBConnection();

      const systemConstantService = new SystemConstantService(mockDBConnection);

      const repo = sinon
        .stub(SystemConstantRepository.prototype, 'getSystemConstants')
        .resolves([{ system_constant_id: 1 }, { system_constant_id: 1 }] as unknown as ISystemConstant[]);

      const response = await systemConstantService.getSystemConstants(['constant_name_1', 'constant_name_2']);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql([{ system_constant_id: 1 }, { system_constant_id: 1 }]);
    });
  });
});
