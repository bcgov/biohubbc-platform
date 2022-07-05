import chai, { expect } from 'chai';
import { FeatureCollection } from 'geojson';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import SQL from 'sql-template-strings';
import { ApiGeneralError } from '../errors/api-error';
import * as spatialUtils from '../utils/spatial-utils';
import { getMockDBConnection } from '../__mocks__/db';
import {
  IInsertSpatialTransform,
  ISpatialComponentsSearchCriteria,
  ISubmissionSpatialComponent,
  SpatialRepository
} from './spatial-repository';

chai.use(sinonChai);

describe('SpatialRepository', () => {
  describe('insertSpatialTransform', () => {
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

      const spatialRepository = new SpatialRepository(mockDBConnection);

      try {
        await spatialRepository.insertSpatialTransform({} as unknown as IInsertSpatialTransform);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert spatial transform details');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ spatial_transform_id: 1 }] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.insertSpatialTransform({} as unknown as IInsertSpatialTransform);

      expect(response.spatial_transform_id).to.equal(1);
    });
  });

  describe('getSpatialTransformBySpatialTransformId', () => {
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

      const spatialRepository = new SpatialRepository(mockDBConnection);

      try {
        await spatialRepository.getSpatialTransformBySpatialTransformId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get spatial transform');
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

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.getSpatialTransformBySpatialTransformId(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('insertSpatialTransformSubmissionRecord', () => {
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

      const spatialRepository = new SpatialRepository(mockDBConnection);

      try {
        await spatialRepository.insertSpatialTransformSubmissionRecord(1, 1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal(
          'Failed to insert spatial transform submission id and submission spatial component id'
        );
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ spatial_transform_submission_id: 1 }] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.insertSpatialTransformSubmissionRecord(1, 1);

      expect(response.spatial_transform_submission_id).to.equal(1);
    });
  });

  describe('runSpatialTransformOnSubmissionId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when transform sql query fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        query: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      try {
        await spatialRepository.runSpatialTransformOnSubmissionId(1, 'string');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to run transform on submission id');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            result_data: {
              type: 'FeatureCollection',
              features: []
            } as FeatureCollection
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        query: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.runSpatialTransformOnSubmissionId(1, 'string');

      expect(response).to.eql({
        type: 'FeatureCollection',
        features: []
      });
    });
  });

  describe('insertSubmissionSpatialComponent', () => {
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

      const spatialRepository = new SpatialRepository(mockDBConnection);

      try {
        await spatialRepository.insertSubmissionSpatialComponent(1, {} as FeatureCollection);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal(
          'Failed to insert submission spatial component details'
        );
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_spatial_component_id: 1 }] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.insertSubmissionSpatialComponent(1, {} as FeatureCollection);

      expect(response.submission_spatial_component_id).to.equal(1);
    });

    it('should succeed with valid data and append geography to sql statment', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_spatial_component_id: 1 }] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const generateGeometryCollectionSQLStub = sinon
        .stub(spatialUtils, 'generateGeometryCollectionSQL')
        .returns(SQL`valid`);

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.insertSubmissionSpatialComponent(1, {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [125.6, 10.1]
            },
            properties: {}
          }
        ]
      } as FeatureCollection);

      expect(response.submission_spatial_component_id).to.equal(1);
      expect(generateGeometryCollectionSQLStub).to.be.calledOnce;
    });
  });

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
