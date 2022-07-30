import chai, { expect } from 'chai';
import { FeatureCollection } from 'geojson';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  IInsertSpatialTransform,
  ISpatialComponentsSearchCriteria,
  ISubmissionSpatialSearchResponseRow,
  SpatialRepository
} from '../repositories/spatial-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SpatialService } from './spatial-service';

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

      await spatialService.runSpatialTransforms(9);

      expect(getSpatialTransformRecordsStub).to.be.calledOnceWith();
      expect(runSpatialTransformOnSubmissionIdStub).to.be.calledWith(9, 'transform1').calledWith(9, 'transform2');
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

  describe('findSpatialComponentsByCriteria', () => {
    it('should return spatial component search result rows', async () => {
      const mockDBConnection = getMockDBConnection();
      const spatialService = new SpatialService(mockDBConnection);

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
        boundary: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } }
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
});
