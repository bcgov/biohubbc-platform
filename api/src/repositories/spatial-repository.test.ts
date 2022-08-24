import chai, { expect } from 'chai';
import { FeatureCollection } from 'geojson';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import SQL from 'sql-template-strings';
import { SYSTEM_ROLE } from '../constants/roles';
import { ApiGeneralError } from '../errors/api-error';
import { UserObject } from '../models/user';
import { UserService } from '../services/user-service';
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

  describe('getSpatialTransformRecords', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            spatial_transform_id: 1,
            name: 'transform name',
            description: 'transform description',
            notes: 'notes',
            transform: 'transform details'
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.getSpatialTransformRecords();

      expect(response[0].spatial_transform_id).to.equal(1);
      expect(response[0].name).to.equal('transform name');
      expect(response[0].description).to.equal('transform description');
      expect(response[0].notes).to.equal('notes');
      expect(response[0].transform).to.equal('transform details');
    });
  });

  describe('getSecurityTransformRecords', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            security_transform_id: 1,
            name: 'transform name',
            description: 'transform description',
            notes: 'notes',
            transform: 'transform details'
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.getSecurityTransformRecords();

      expect(response[0].security_transform_id).to.equal(1);
      expect(response[0].name).to.equal('transform name');
      expect(response[0].description).to.equal('transform description');
      expect(response[0].notes).to.equal('notes');
      expect(response[0].transform).to.equal('transform details');
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

  describe('insertSecurityTransformSubmissionRecord', () => {
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
        await spatialRepository.insertSecurityTransformSubmissionRecord(1, 1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal(
          'Failed to insert security transform submission id and submission spatial component id'
        );
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ security_transform_submission_id: 1 }] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.insertSecurityTransformSubmissionRecord(1, 1);

      expect(response.security_transform_submission_id).to.equal(1);
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
        expect((actualError as ApiGeneralError).message).to.equal('Failed to run spatial transform on submission id');
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

      expect(response).to.eql([
        {
          result_data: {
            type: 'FeatureCollection',
            features: []
          } as FeatureCollection
        }
      ]);
    });
  });

  describe('runSecurityTransformOnSubmissionId', () => {
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
        await spatialRepository.runSecurityTransformOnSubmissionId(1, 'string');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to run security transform on submission id');
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

      const response = await spatialRepository.runSecurityTransformOnSubmissionId(1, 'string');

      expect(response).to.eql([
        {
          result_data: {
            type: 'FeatureCollection',
            features: []
          } as FeatureCollection
        }
      ]);
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

    it('should succeed with valid data and append geography to sql statement', async () => {
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

  describe('updateSubmissionSpatialComponent', () => {
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
        await spatialRepository.updateSubmissionSpatialComponentWithSecurity(1, {} as object);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal(
          'Failed to update submission spatial component details'
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

      const response = await spatialRepository.updateSubmissionSpatialComponentWithSecurity(1, {} as object);

      expect(response.submission_spatial_component_id).to.equal(1);
    });
  });

  describe('findSpatialComponentsByCriteria', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should call _findSpatialComponentsByCriteriaAsAdminUser when user is a system admin', async () => {
      const mockDBConnection = getMockDBConnection();

      const mockUserObject = { role_names: [SYSTEM_ROLE.SYSTEM_ADMIN] } as unknown as UserObject;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const findSpatialComponentsByCriteriaAsAdminUserStub = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteriaAsAdminUser')
        .resolves();
      const findSpatialComponentsByCriteriaStub = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteria')
        .resolves();

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }
      };

      await spatialRepository.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(findSpatialComponentsByCriteriaAsAdminUserStub).to.have.been.calledOnce;
      expect(findSpatialComponentsByCriteriaStub).not.to.have.been.called;
    });

    it('should call _findSpatialComponentsByCriteriaAsAdminUser when user is a data admin', async () => {
      const mockDBConnection = getMockDBConnection();

      const mockUserObject = { role_names: [SYSTEM_ROLE.DATA_ADMINISTRATOR] } as unknown as UserObject;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const findSpatialComponentsByCriteriaAsAdminUserStub = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteriaAsAdminUser')
        .resolves();
      const findSpatialComponentsByCriteriaStub = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteria')
        .resolves();

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }
      };

      await spatialRepository.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(findSpatialComponentsByCriteriaAsAdminUserStub).to.have.been.calledOnce;
      expect(findSpatialComponentsByCriteriaStub).not.to.have.been.called;
    });

    it('should call _findSpatialComponentsByCriteria', async () => {
      const mockDBConnection = getMockDBConnection();

      const mockUserObject = { role_names: [] } as unknown as UserObject;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const findSpatialComponentsByCriteriaAsAdminUserStub = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteriaAsAdminUser')
        .resolves();
      const findSpatialComponentsByCriteriaStub = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteria')
        .resolves();

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }
      };

      await spatialRepository.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(findSpatialComponentsByCriteriaAsAdminUserStub).not.to.have.been.called;
      expect(findSpatialComponentsByCriteriaStub).to.have.been.calledOnce;
    });
  });

  describe('_findSpatialComponentsByCriteriaAsAdminUser', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with minimal search criteria', async () => {
      const mockResponseRow1 = { submission_spatial_component_id: 1 } as unknown as ISubmissionSpatialComponent;
      const mockResponseRow2 = { submission_spatial_component_id: 2 } as unknown as ISubmissionSpatialComponent;
      const mockQueryResponse = { rowCount: 2, rows: [mockResponseRow1, mockResponseRow2] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }
      };

      const response = await spatialRepository.findSpatialComponentsByCriteriaAsAdminUser(mockSearchCriteria);

      expect(response).to.eql([mockResponseRow1, mockResponseRow2]);
    });

    it('should succeed with maximal search criteria', async () => {
      const mockResponseRow1 = { submission_spatial_component_id: 1 } as unknown as ISubmissionSpatialComponent;
      const mockResponseRow2 = { submission_spatial_component_id: 2 } as unknown as ISubmissionSpatialComponent;
      const mockQueryResponse = { rowCount: 2, rows: [mockResponseRow1, mockResponseRow2] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        type: ['Occurrence', 'Boundary'],
        datasetID: ['111-111-111', '222-222-222'],
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }
      };

      const response = await spatialRepository.findSpatialComponentsByCriteriaAsAdminUser(mockSearchCriteria);

      expect(response).to.eql([mockResponseRow1, mockResponseRow2]);
    });
  });

  describe('_findSpatialComponentsByCriteria', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with minimal search criteria', async () => {
      const mockResponseRow1 = { submission_spatial_component_id: 1 } as unknown as ISubmissionSpatialComponent;
      const mockResponseRow2 = { submission_spatial_component_id: 2 } as unknown as ISubmissionSpatialComponent;
      const mockQueryResponse = { rowCount: 2, rows: [mockResponseRow1, mockResponseRow2] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }
      };

      const response = await spatialRepository.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(response).to.eql([mockResponseRow1, mockResponseRow2]);
    });

    it('should succeed with maximal search criteria', async () => {
      const mockResponseRow1 = { submission_spatial_component_id: 1 } as unknown as ISubmissionSpatialComponent;
      const mockResponseRow2 = { submission_spatial_component_id: 2 } as unknown as ISubmissionSpatialComponent;
      const mockQueryResponse = { rowCount: 2, rows: [mockResponseRow1, mockResponseRow2] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        type: ['Occurrence', 'Boundary'],
        datasetID: ['111-111-111', '222-222-222'],
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }
      };

      const response = await spatialRepository.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(response).to.eql([mockResponseRow1, mockResponseRow2]);
    });
  });

  describe('deleteSpatialComponentsBySubmissionId', () => {
    it('should successfully return submission IDs for delete spatial data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 2 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.deleteSpatialComponentsBySubmissionId(2);

      expect(response[0].submission_id).to.equal(2);
    });
  });

  describe('deleteSpatialComponentsSpatialRefsBySubmissionId', () => {
    it('should successfully return submission IDs for deleted spatial component reference', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 2 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.deleteSpatialComponentsSpatialTransformRefsBySubmissionId(2);

      expect(response[0].submission_id).to.equal(2);
    });
  });

  describe('deleteSpatialComponentsSecurityRefsBySubmissionId', () => {
    it('should successfully return submission IDs for deleted spatial component reference', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 2 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const spatialRepository = new SpatialRepository(mockDBConnection);

      const response = await spatialRepository.deleteSpatialComponentsSecurityTransformRefsBySubmissionId(2);

      expect(response[0].submission_id).to.equal(2);
    });
  });
});
