import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SYSTEM_ROLE } from '../constants/roles';
import { SPATIAL_COMPONENT_TYPE } from '../constants/spatial';
import {
  IGetSecurityTransformRecord,
  IGetSpatialTransformRecord,
  IInsertSpatialTransform,
  ISpatialComponentFeaturePropertiesRow,
  ISpatialComponentsSearchCriteria,
  ISubmissionSpatialSearchResponseRow,
  SpatialRepository
} from '../repositories/spatial-repository';
import { SystemUserExtended } from '../repositories/user-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { Srid3005 } from './geo-service';
import { SpatialService } from './spatial-service';
import { UserService } from './user-service';

chai.use(sinonChai);

describe('SpatialService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSpatialTransform', () => {
    it('should return spatial_transform_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const repo = sinon
        .stub(SpatialRepository.prototype, 'insertSpatialTransform')
        .resolves({ spatial_transform_id: 1 });

      const response = await spatialService.insertSpatialTransform({} as unknown as IInsertSpatialTransform);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ spatial_transform_id: 1 });
    });
  });

  describe('getSpatialTransformRecords', () => {
    it('should return IGetSpatialTransformRecord on get', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const repo = sinon
        .stub(SpatialRepository.prototype, 'getSpatialTransformRecords')
        .resolves([{ name: 'name' }] as unknown as IGetSpatialTransformRecord[]);

      const response = await spatialService.getSpatialTransformRecords();

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql([{ name: 'name' }]);
    });
  });

  describe('getSecurityTransformRecords', () => {
    it('should return IGetSecurityTransformRecord on get', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const repo = sinon
        .stub(SpatialRepository.prototype, 'getSecurityTransformRecords')
        .resolves([{ name: 'name' }] as unknown as IGetSecurityTransformRecord[]);

      const response = await spatialService.getSecurityTransformRecords();

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql([{ name: 'name' }]);
    });
  });

  describe('insertSpatialTransformSubmissionRecord', () => {
    it('should return spatial_transform_submission_id after insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const repo = sinon
        .stub(SpatialRepository.prototype, 'insertSpatialTransformSubmissionRecord')
        .resolves({ spatial_transform_submission_id: 1 });

      const response = await spatialService.insertSpatialTransformSubmissionRecord(1, 1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ spatial_transform_submission_id: 1 });
    });
  });

  describe('insertSecurityTransformSubmissionRecord', () => {
    it('should return security_transform_submission_id after insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const repo = sinon
        .stub(SpatialRepository.prototype, 'insertSecurityTransformSubmissionRecord')
        .resolves({ security_transform_submission_id: 1 });

      const response = await spatialService.insertSecurityTransformSubmissionRecord(1, 1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ security_transform_submission_id: 1 });
    });
  });

  describe('findSpatialComponentsByCriteria', () => {
    it('should return spatial component search result rows', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);
      const mockUserObject = { role_names: [] } as unknown as SystemUserExtended;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const mockResponseRows = [
        {
          spatial_component: {
            spatial_data: {},
            submission_spatial_component_id: 1
          }
        },
        {
          spatial_component: {
            spatial_data: {},
            submission_spatial_component_id: 2
          }
        }
      ] as unknown as ISubmissionSpatialSearchResponseRow[];

      const repo = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteria')
        .resolves(mockResponseRows);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        type: ['Occurrence'],
        boundary: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }]
      };

      const response = await spatialService.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(mockResponseRows);
    });

    it('should call findSpatialComponentsByCriteriaAsAdminUser as data admin', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);
      const mockUserObject = { role_names: [SYSTEM_ROLE.DATA_ADMINISTRATOR] } as unknown as SystemUserExtended;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const findSpatialComponentsByCriteriaAsAdminUserStub = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteriaAsAdminUser')
        .resolves();
      const findSpatialComponentsByCriteriaStub = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteria')
        .resolves();

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        type: ['Occurrence'],
        boundary: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }]
      };

      await spatialService.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(findSpatialComponentsByCriteriaAsAdminUserStub).to.be.calledOnce;
      expect(findSpatialComponentsByCriteriaStub).not.to.have.been.called;
    });

    it('should call findSpatialComponentsByCriteriaAsAdminUser as system admin', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);
      const mockUserObject = { role_names: [SYSTEM_ROLE.SYSTEM_ADMIN] } as unknown as SystemUserExtended;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const findSpatialComponentsByCriteriaAsAdminUserStub = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteriaAsAdminUser')
        .resolves();
      const findSpatialComponentsByCriteriaStub = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteria')
        .resolves();

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        type: ['Occurrence'],
        boundary: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }]
      };

      await spatialService.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(findSpatialComponentsByCriteriaAsAdminUserStub).to.be.calledOnce;
      expect(findSpatialComponentsByCriteriaStub).not.to.have.been.called;
    });

    it('should return spatial component search result rows', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);
      const mockUserObject = { role_names: [] } as unknown as SystemUserExtended;
      sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

      const mockResponseRows = [
        {
          spatial_component: {
            spatial_data: {},
            submission_spatial_component_id: 1
          }
        },
        {
          spatial_component: {
            spatial_data: {},
            submission_spatial_component_id: 2
          }
        }
      ] as unknown as ISubmissionSpatialSearchResponseRow[];

      const repo = sinon
        .stub(SpatialRepository.prototype, 'findSpatialComponentsByCriteria')
        .resolves(mockResponseRows);

      const mockSearchCriteria: ISpatialComponentsSearchCriteria = {
        type: ['Occurrence'],
        boundary: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }]
      };

      const response = await spatialService.findSpatialComponentsByCriteria(mockSearchCriteria);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(mockResponseRows);
    });
  });

  describe('deleteSpatialComponentsBySubmissionId', () => {
    it('should return submission IDs upon deleting spatial data', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const mockResponseRows = [{ submission_id: 3 }] as unknown as { submission_id: number }[];

      const repo = sinon
        .stub(SpatialRepository.prototype, 'deleteSpatialComponentsBySubmissionId')
        .resolves(mockResponseRows);

      const response = await spatialService.deleteSpatialComponentsBySubmissionId(3);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(mockResponseRows);
    });
  });

  describe('deleteSpatialComponentsSpatialTransformRefsBySubmissionId', () => {
    it('should return submission IDs upon deleting spatial data', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const mockResponseRows = [{ submission_id: 3 }] as unknown as { submission_id: number }[];

      const repo = sinon
        .stub(SpatialRepository.prototype, 'deleteSpatialComponentsSpatialTransformRefsBySubmissionId')
        .resolves(mockResponseRows);

      const response = await spatialService.deleteSpatialComponentsSpatialTransformRefsBySubmissionId(3);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(mockResponseRows);
    });
  });

  describe('deleteSpatialComponentsSecurityTransformRefsBySubmissionId', () => {
    it('should return submission IDs upon deleting security data', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const mockResponseRows = [{ submission_id: 3 }] as unknown as { submission_id: number }[];

      const repo = sinon
        .stub(SpatialRepository.prototype, 'deleteSpatialComponentsSecurityTransformRefsBySubmissionId')
        .resolves(mockResponseRows);

      const response = await spatialService.deleteSpatialComponentsSecurityTransformRefsBySubmissionId(3);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(mockResponseRows);
    });
  });

  describe('findSpatialMetadataBySubmissionSpatialComponentIds', () => {
    describe('with multiple features', () => {
      it('should return spatial component metadata', async () => {
        const mockDBConnection = getMockDBConnection();
        const spatialService = new SpatialService(mockDBConnection);
        const mockUserObject = { role_names: [] } as unknown as SystemUserExtended;
        sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

        const mockResponseRows: ISpatialComponentFeaturePropertiesRow[] = [
          {
            spatial_component_properties: {
              prop1: 'val1',
              prop2: 'val2'
            }
          }
        ];

        const repo = sinon
          .stub(SpatialRepository.prototype, 'findSpatialMetadataBySubmissionSpatialComponentIds')
          .resolves(mockResponseRows);

        const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentIds([3]);

        expect(repo).to.be.calledOnce;
        expect(response).to.be.eql([{ prop1: 'val1', prop2: 'val2' }]);
      });
    });

    describe('with single feature', () => {
      it('should return spatial component metadata', async () => {
        const mockDBConnection = getMockDBConnection();
        const spatialService = new SpatialService(mockDBConnection);
        const mockUserObject = { role_names: [] } as unknown as SystemUserExtended;
        sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

        const mockResponseRows: ISpatialComponentFeaturePropertiesRow[] = [
          {
            spatial_component_properties: {
              prop1: 'val1',
              prop2: 'val2'
            }
          },
          {
            spatial_component_properties: {
              prop3: 'val3',
              prop4: 'val4'
            }
          }
        ];

        const repo = sinon
          .stub(SpatialRepository.prototype, 'findSpatialMetadataBySubmissionSpatialComponentIds')
          .resolves(mockResponseRows);

        const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentIds([3]);

        expect(repo).to.be.calledOnce;
        expect(response).to.be.eql([
          { prop1: 'val1', prop2: 'val2' },
          { prop3: 'val3', prop4: 'val4' }
        ]);
      });
    });

    describe('with single feature', () => {
      it('should return spatial component metadata as system admin', async () => {
        const mockDBConnection = getMockDBConnection();
        const spatialService = new SpatialService(mockDBConnection);
        const mockUserObject = { role_names: [SYSTEM_ROLE.SYSTEM_ADMIN] } as unknown as SystemUserExtended;
        sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

        const mockResponseRows: ISpatialComponentFeaturePropertiesRow[] = [
          {
            spatial_component_properties: {
              prop1: 'val1',
              prop2: 'val2'
            }
          },
          {
            spatial_component_properties: {
              prop3: 'val3',
              prop4: 'val4'
            }
          }
        ];

        const repo = sinon
          .stub(SpatialRepository.prototype, 'findSpatialMetadataBySubmissionSpatialComponentIdsAsAdmin')
          .resolves(mockResponseRows);

        const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentIds([3]);

        expect(repo).to.be.calledOnce;
        expect(response).to.be.eql([
          { prop1: 'val1', prop2: 'val2' },
          { prop3: 'val3', prop4: 'val4' }
        ]);
      });

      it('should return spatial component metadata as data admin', async () => {
        const mockDBConnection = getMockDBConnection();
        const spatialService = new SpatialService(mockDBConnection);
        const mockUserObject = { role_names: [SYSTEM_ROLE.DATA_ADMINISTRATOR] } as unknown as SystemUserExtended;
        sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

        const mockResponseRows: ISpatialComponentFeaturePropertiesRow[] = [
          {
            spatial_component_properties: {
              prop1: 'val1',
              prop2: 'val2'
            }
          },
          {
            spatial_component_properties: {
              prop3: 'val3',
              prop4: 'val4'
            }
          }
        ];

        const repo = sinon
          .stub(SpatialRepository.prototype, 'findSpatialMetadataBySubmissionSpatialComponentIdsAsAdmin')
          .resolves(mockResponseRows);

        const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentIds([3]);

        expect(repo).to.be.calledOnce;
        expect(response).to.be.eql([
          { prop1: 'val1', prop2: 'val2' },
          { prop3: 'val3', prop4: 'val4' }
        ]);
      });

      it('should return non secure spatial component metadata when user is not admin', async () => {
        const mockDBConnection = getMockDBConnection();
        const spatialService = new SpatialService(mockDBConnection);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);

        const mockResponseRows: ISpatialComponentFeaturePropertiesRow[] = [
          {
            spatial_component_properties: {
              prop1: 'val1',
              prop2: 'val2'
            }
          },
          {
            spatial_component_properties: {
              prop3: 'val3',
              prop4: 'val4'
            }
          }
        ];

        const repo = sinon
          .stub(SpatialRepository.prototype, 'findSpatialMetadataBySubmissionSpatialComponentIds')
          .resolves(mockResponseRows);

        const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentIds([3]);

        expect(repo).to.be.calledOnce;
        expect(response).to.be.eql([
          { prop1: 'val1', prop2: 'val2' },
          { prop3: 'val3', prop4: 'val4' }
        ]);
      });
    });

    describe('with no features', () => {
      it('should return [] as system admin', async () => {
        const mockDBConnection = getMockDBConnection();
        const spatialService = new SpatialService(mockDBConnection);
        const mockUserObject = { role_names: [SYSTEM_ROLE.SYSTEM_ADMIN] } as unknown as SystemUserExtended;
        sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

        const repo = sinon
          .stub(SpatialRepository.prototype, 'findSpatialMetadataBySubmissionSpatialComponentIdsAsAdmin')
          .resolves([]);

        const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentIds([3]);

        expect(repo).to.be.calledOnce;
        expect(response).to.be.eql([]);
      });

      it('should return [] as data admin', async () => {
        const mockDBConnection = getMockDBConnection();
        const spatialService = new SpatialService(mockDBConnection);
        const mockUserObject = { role_names: [SYSTEM_ROLE.DATA_ADMINISTRATOR] } as unknown as SystemUserExtended;
        sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

        const repo = sinon
          .stub(SpatialRepository.prototype, 'findSpatialMetadataBySubmissionSpatialComponentIdsAsAdmin')
          .resolves([]);

        const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentIds([3]);

        expect(repo).to.be.calledOnce;
        expect(response).to.be.eql([]);
      });

      it('should return [] when user is not admin', async () => {
        const mockDBConnection = getMockDBConnection();
        const spatialService = new SpatialService(mockDBConnection);
        sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);

        const repo = sinon
          .stub(SpatialRepository.prototype, 'findSpatialMetadataBySubmissionSpatialComponentIds')
          .resolves([]);

        const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentIds([3]);

        expect(repo).to.be.calledOnce;
        expect(response).to.be.eql([]);
      });
    });
  });

  describe('getGeometryAsWktFromBoundarySpatialComponentBySubmissionId', () => {
    it('returns a geometry WKT string', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const submissionId = 1;

      const mockResponse = { geometry: 'POLYGON(123,456,789)' };

      const repo = sinon
        .stub(SpatialRepository.prototype, 'getGeometryAsWktFromBoundarySpatialComponentBySubmissionId')
        .resolves(mockResponse);

      const response = await spatialService.getGeometryAsWktFromBoundarySpatialComponentBySubmissionId(
        submissionId,
        SPATIAL_COMPONENT_TYPE.BOUNDARY_CENTROID,
        Srid3005
      );

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(mockResponse);
    });
  });
});
