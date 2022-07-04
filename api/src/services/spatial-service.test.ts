import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  ISpatialComponentsSearchCriteria,
  ISubmissionSpatialComponent,
  SpatialRepository
} from '../repositories/spatial-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SpatialService } from './spatial-service';

chai.use(sinonChai);

describe('SpatialService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findSpatialComponentsByCriteria', () => {
    it('should return spatial component search result rows', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new SpatialService(mockDBConnection);

      const mockResponseRows = [
        { submission_spatial_component_id: 1 },
        { submission_spatial_component_id: 2 }
      ] as unknown as ISubmissionSpatialComponent[];

      const repo = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteria')
        .resolves(mockResponseRows);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        type: ['Occurrence'],
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }
      };

      const response = await validationService.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(mockResponseRows);
    });
  });
});
