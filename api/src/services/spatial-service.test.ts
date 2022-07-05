import chai, { expect } from 'chai';
import { FeatureCollection } from 'geojson';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  IInsertSpatialTransform,
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

  describe('insertSpatialTransform', () => {
    it('should return spatial_transform_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new SpatialService(mockDBConnection);

      const repo = sinon
        .stub(SpatialRepository.prototype, 'insertSpatialTransform')
        .resolves({ spatial_transform_id: 1 });

      const response = await validationService.insertSpatialTransform({} as unknown as IInsertSpatialTransform);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ spatial_transform_id: 1 });
    });
  });

  describe('getSpatialTransformBySpatialTransformId', () => {
    it('should return transform row object', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new SpatialService(mockDBConnection);

      const repo = sinon
        .stub(SpatialRepository.prototype, 'getSpatialTransformBySpatialTransformId')
        .resolves({ transform: 'string' });

      const response = await validationService.getSpatialTransformBySpatialTransformId(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ transform: 'string' });
    });
  });

  describe('insertSpatialTransformSubmissionRecord', () => {
    it('should return spatial_transform_submission_id after insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new SpatialService(mockDBConnection);

      const repo = sinon
        .stub(SpatialRepository.prototype, 'insertSpatialTransformSubmissionRecord')
        .resolves({ spatial_transform_submission_id: 1 });

      const response = await validationService.insertSpatialTransformSubmissionRecord(1, 1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ spatial_transform_submission_id: 1 });
    });
  });

  describe('runTransform', () => {
    it('should return submission_spatial_component_id after running transform and inserting data', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new SpatialService(mockDBConnection);

      const getSpatialTransformBySpatialTransformIdStub = sinon
        .stub(SpatialService.prototype, 'getSpatialTransformBySpatialTransformId')
        .resolves({ transform: 'string' });

      const runSpatialTransformOnSubmissionIdStub = sinon
        .stub(SpatialRepository.prototype, 'runSpatialTransformOnSubmissionId')
        .resolves({} as unknown as FeatureCollection);

      const insertSubmissionSpatialComponentStub = sinon
        .stub(SpatialRepository.prototype, 'insertSubmissionSpatialComponent')
        .resolves({ submission_spatial_component_id: 1 });

      const response = await validationService.runTransform(1, 1);

      expect(getSpatialTransformBySpatialTransformIdStub).to.be.calledOnce;
      expect(runSpatialTransformOnSubmissionIdStub).to.be.calledOnce;
      expect(insertSubmissionSpatialComponentStub).to.be.calledOnce;
      expect(response).to.be.eql({ submission_spatial_component_id: 1 });
    });
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
