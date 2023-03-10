import chai, { expect } from 'chai';
import { FeatureCollection } from 'geojson';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SYSTEM_ROLE } from '../constants/roles';
import { UserObject } from '../models/user';
import {
  IGetSecurityTransformRecord,
  IGetSpatialTransformRecord,
  IInsertSpatialTransform,
  ISpatialComponentFeaturePropertiesRow,
  ISpatialComponentsSearchCriteria,
  ISubmissionSpatialSearchResponseRow,
  SpatialRepository
} from '../repositories/spatial-repository';
import { getMockDBConnection } from '../__mocks__/db';
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

  describe('runSpatialTransforms', () => {
    it('should return submission_spatial_component_id after running transform and inserting data', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const getSpatialTransformRecordsStub = sinon
        .stub(SpatialService.prototype, 'getSpatialTransformRecords')
        .resolves([
          {
            spatial_transform_id: 1,
            name: 'name1',
            description: null,
            notes: null,
            transform: 'transform1'
          },
          {
            spatial_transform_id: 2,
            name: 'name2',
            description: null,
            notes: null,
            transform: 'transform2'
          }
        ]);

      const runSpatialTransformOnSubmissionIdStub = sinon
        .stub(SpatialRepository.prototype, 'runSpatialTransformOnSubmissionId')
        .onCall(0)
        .resolves([
          { result_data: 'result1' as unknown as FeatureCollection },
          { result_data: 'result2' as unknown as FeatureCollection }
        ])
        .onCall(1)
        .resolves([
          { result_data: 'result3' as unknown as FeatureCollection },
          { result_data: 'result4' as unknown as FeatureCollection }
        ]);

      const insertSubmissionSpatialComponentStub = sinon
        .stub(SpatialRepository.prototype, 'insertSubmissionSpatialComponent')
        .onCall(0)
        .resolves({ submission_spatial_component_id: 3 })
        .onCall(1)
        .resolves({ submission_spatial_component_id: 4 })
        .onCall(2)
        .resolves({ submission_spatial_component_id: 5 })
        .onCall(3)
        .resolves({ submission_spatial_component_id: 6 });

      const insertSpatialTransformSubmissionRecordStub = sinon
        .stub(SpatialRepository.prototype, 'insertSpatialTransformSubmissionRecord')
        .resolves();

      await spatialService.runSpatialTransforms(8, 9);

      expect(getSpatialTransformRecordsStub).to.be.calledOnceWith();
      expect(runSpatialTransformOnSubmissionIdStub).to.be.calledWith(8, 'transform1').calledWith(8, 'transform2');
      expect(insertSubmissionSpatialComponentStub)
        .to.be.calledWith(9, 'result1')
        .calledWith(9, 'result2')
        .calledWith(9, 'result3')
        .calledWith(9, 'result4');
      expect(insertSpatialTransformSubmissionRecordStub)
        .to.be.calledWith(1, 3)
        .calledWith(1, 4)
        .calledWith(2, 5)
        .calledWith(2, 6);
    });
  });

  describe('runSecurityTransforms', () => {
    it('should return submission_security_component_id after running transform and updating data', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

      const getSecurityTransformRecordsStub = sinon
        .stub(SpatialService.prototype, 'getSecurityTransformRecords')
        .resolves([
          {
            security_transform_id: 1,
            name: 'name1',
            description: null,
            notes: null,
            transform: 'transform1'
          },
          {
            security_transform_id: 2,
            name: 'name2',
            description: null,
            notes: null,
            transform: 'transform2'
          }
        ]);

      const runSecurityTransformOnSubmissionIdStub = sinon
        .stub(SpatialRepository.prototype, 'runSecurityTransformOnSubmissionId')
        .onCall(0)
        .resolves([
          {
            spatial_component: {
              submission_spatial_component_id: 1,
              spatial_data: 'result1' as unknown as FeatureCollection
            }
          },
          {
            spatial_component: {
              submission_spatial_component_id: 2,
              spatial_data: 'result2' as unknown as FeatureCollection
            }
          }
        ])
        .onCall(1)
        .resolves([
          {
            spatial_component: {
              submission_spatial_component_id: 3,
              spatial_data: 'result3' as unknown as FeatureCollection
            }
          },
          {
            spatial_component: {
              submission_spatial_component_id: 4,
              spatial_data: 'result4' as unknown as FeatureCollection
            }
          }
        ]);

      const updateSubmissionSpatialComponentStub = sinon
        .stub(SpatialRepository.prototype, 'updateSubmissionSpatialComponentWithSecurity')
        .onCall(0)
        .resolves({ submission_spatial_component_id: 3 })
        .onCall(1)
        .resolves({ submission_spatial_component_id: 4 })
        .onCall(2)
        .resolves({ submission_spatial_component_id: 5 })
        .onCall(3)
        .resolves({ submission_spatial_component_id: 6 });

      const insertSecurityTransformSubmissionRecordStub = sinon
        .stub(SpatialRepository.prototype, 'insertSecurityTransformSubmissionRecord')
        .resolves();

      await spatialService.runSecurityTransforms(9);

      expect(getSecurityTransformRecordsStub).to.be.calledOnceWith();
      expect(runSecurityTransformOnSubmissionIdStub).to.be.calledWith(9, 'transform1').calledWith(9, 'transform2');
      expect(updateSubmissionSpatialComponentStub)
        .to.be.calledWith(1, 'result1')
        .calledWith(2, 'result2')
        .calledWith(3, 'result3')
        .calledWith(4, 'result4');
      expect(insertSecurityTransformSubmissionRecordStub)
        .to.be.calledWith(1, 3)
        .calledWith(1, 4)
        .calledWith(2, 5)
        .calledWith(2, 6);
    });
  });

  describe('findSpatialComponentsByCriteria', () => {
    it('should return spatial component search result rows', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);
      const mockUserObject = { role_names: [] } as unknown as UserObject;
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
      const mockUserObject = { role_names: [SYSTEM_ROLE.DATA_ADMINISTRATOR] } as unknown as UserObject;
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
      const mockUserObject = { role_names: [SYSTEM_ROLE.SYSTEM_ADMIN] } as unknown as UserObject;
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
      const mockUserObject = { role_names: [] } as unknown as UserObject;
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
        const mockUserObject = { role_names: [] } as unknown as UserObject;
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
        const mockUserObject = { role_names: [] } as unknown as UserObject;
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
        const mockUserObject = { role_names: [SYSTEM_ROLE.SYSTEM_ADMIN] } as unknown as UserObject;
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
        const mockUserObject = { role_names: [SYSTEM_ROLE.DATA_ADMINISTRATOR] } as unknown as UserObject;
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
        const mockUserObject = { role_names: [SYSTEM_ROLE.SYSTEM_ADMIN] } as unknown as UserObject;
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
        const mockUserObject = { role_names: [SYSTEM_ROLE.DATA_ADMINISTRATOR] } as unknown as UserObject;
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
});
