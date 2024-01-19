import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { RegionRepository } from '../repositories/region-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { RegionService } from './region-service';

chai.use(sinonChai);

describe('RegionService', () => {
  describe('calculateAndAddRegionsForSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new RegionService(mockDBConnection);

      const calculate = sinon
        .stub(RegionRepository.prototype, 'calculateRegionsForASubmission')
        .resolves([{ region_id: 1 }]);
      const insert = sinon.stub(RegionRepository.prototype, 'insertSubmissionRegions').resolves();

      await service.calculateAndAddRegionsForSubmission(1);

      expect(calculate).to.be.called;
      expect(insert).to.be.called;
    });

    it('should succeed with modified parameters', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new RegionService(mockDBConnection);

      const calculate = sinon
        .stub(RegionRepository.prototype, 'calculateRegionsForASubmission')
        .resolves([{ region_id: 1 }]);
      const insert = sinon.stub(RegionRepository.prototype, 'insertSubmissionRegions').resolves();

      await service.calculateAndAddRegionsForSubmission(1, 0.5);

      expect(calculate).to.be.calledWith(1, 0.5);
      expect(insert).to.be.called;
    });
  });
});
