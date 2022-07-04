import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ISpatialComponentsSearchCriteria, ISubmissionSpatialComponent, SpatialRepository } from './spatial-repository';

chai.use(sinonChai);

describe('SpatialRepository', () => {
  describe('findSpatialComponentsByCriteria', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponseRow1 = { submission_spatial_component_id: 1 } as unknown as ISubmissionSpatialComponent;
      const mockResponseRow2 = { submission_spatial_component_id: 2 } as unknown as ISubmissionSpatialComponent;
      const mockQueryResponse = { rowCount: 2, rows: [mockResponseRow1, mockResponseRow2] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        type: ['Occurrence'],
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }
      };

      const response = await spatialRepository.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(response).to.eql([mockResponseRow1, mockResponseRow2]);
    });
  });
});
