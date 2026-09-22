import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError } from '../errors/api-error';
import { AdminFeatureTypeProperty } from '../models/feature-type-property';
import { FeaturePropertyRepository } from '../repositories/feature-property-repository';
import { FeatureTypePropertyRepository } from '../repositories/feature-type-property-repository';
import { FeatureTypeRepository } from '../repositories/feature-type-repository';
import { FeatureTypePropertyService } from './feature-type-property-service';

chai.use(sinonChai);

const mockAdminFeatureTypeProperty: AdminFeatureTypeProperty = {
  feature_type_property_id: 1,
  feature_type_id: 10,
  feature_property_id: 20,
  required_value: false,
  sort: null
};

describe('FeatureTypePropertyService', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('instantiates repository fields in the constructor', () => {
    const mockConnection = getMockDBConnection();
    const service = new FeatureTypePropertyService(mockConnection);

    expect(service.featureTypePropertyRepository).to.be.instanceof(FeatureTypePropertyRepository);
    expect(service.featureTypeRepository).to.be.instanceof(FeatureTypeRepository);
    expect(service.featurePropertyRepository).to.be.instanceof(FeaturePropertyRepository);
  });

  describe('createFeatureTypeProperty', () => {
    it('creates and returns the new record when FK references exist and no conflict', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeatureTypePropertyService(mockConnection);

      sinon.stub(service.featureTypeRepository, 'getFeatureType').resolves({ feature_type_id: 10 } as any);
      sinon.stub(service.featurePropertyRepository, 'getFeatureProperty').resolves({ feature_property_id: 20 } as any);
      sinon
        .stub(service.featureTypePropertyRepository, 'findActiveFeatureTypePropertyByFeatureTypeAndProperty')
        .resolves(null);
      sinon.stub(service.featureTypePropertyRepository, 'insertFeatureTypeProperty').resolves(1);
      sinon
        .stub(service.featureTypePropertyRepository, 'getAdminFeatureTypeProperty')
        .resolves(mockAdminFeatureTypeProperty);

      const result = await service.createFeatureTypeProperty({ feature_type_id: 10, feature_property_id: 20 });

      expect(result).to.eql(mockAdminFeatureTypeProperty);
    });

    it('throws ApiNotFoundError when the parent feature type does not exist', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeatureTypePropertyService(mockConnection);

      sinon
        .stub(service.featureTypeRepository, 'getFeatureType')
        .rejects(new ApiNotFoundError('Feature type not found', []));
      sinon.stub(service.featurePropertyRepository, 'getFeatureProperty').resolves({ feature_property_id: 20 } as any);

      try {
        await service.createFeatureTypeProperty({ feature_type_id: 999, feature_property_id: 20 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws ApiNotFoundError when the feature property does not exist', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeatureTypePropertyService(mockConnection);

      sinon.stub(service.featureTypeRepository, 'getFeatureType').resolves({ feature_type_id: 10 } as any);
      sinon
        .stub(service.featurePropertyRepository, 'getFeatureProperty')
        .rejects(new ApiNotFoundError('Feature property not found', []));

      try {
        await service.createFeatureTypeProperty({ feature_type_id: 10, feature_property_id: 999 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws ApiConflictError when the feature property is already assigned to the feature type', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeatureTypePropertyService(mockConnection);

      sinon.stub(service.featureTypeRepository, 'getFeatureType').resolves({ feature_type_id: 10 } as any);
      sinon.stub(service.featurePropertyRepository, 'getFeatureProperty').resolves({ feature_property_id: 20 } as any);
      sinon
        .stub(service.featureTypePropertyRepository, 'findActiveFeatureTypePropertyByFeatureTypeAndProperty')
        .resolves({ feature_type_property_id: 99 });

      try {
        await service.createFeatureTypeProperty({ feature_type_id: 10, feature_property_id: 20 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect((error as ApiConflictError).message).to.equal(
          'Feature property is already assigned to this feature type'
        );
      }
    });
  });

  describe('updateFeatureTypeProperty', () => {
    it('updates the record without checking blueprint assignments when it is not being retired', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeatureTypePropertyService(mockConnection);

      const countStub = sinon
        .stub(service.featureTypePropertyRepository, 'countActiveBlueprintAssignmentsByFeatureTypePropertyId')
        .resolves(3);
      const updateStub = sinon.stub(service.featureTypePropertyRepository, 'updateFeatureTypeProperty').resolves();
      sinon
        .stub(service.featureTypePropertyRepository, 'getAdminFeatureTypeProperty')
        .resolves(mockAdminFeatureTypeProperty);

      const result = await service.updateFeatureTypeProperty(1, 10, { required_value: true });

      expect(countStub).to.not.have.been.called;
      expect(updateStub).to.have.been.calledOnceWith(1, 10, { required_value: true });
      expect(result).to.eql(mockAdminFeatureTypeProperty);
    });

    it('throws ApiConflictError when retiring a pairing an active blueprint assignment references', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeatureTypePropertyService(mockConnection);

      sinon
        .stub(service.featureTypePropertyRepository, 'countActiveBlueprintAssignmentsByFeatureTypePropertyId')
        .resolves(1);
      const updateStub = sinon.stub(service.featureTypePropertyRepository, 'updateFeatureTypeProperty').resolves();

      try {
        await service.updateFeatureTypeProperty(1, 10, { record_end_date: '2026-09-21' });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(updateStub).to.not.have.been.called;
    });
  });

  describe('deleteFeatureTypeProperty', () => {
    it('deletes the record when no active blueprint assignment references it', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeatureTypePropertyService(mockConnection);

      sinon
        .stub(service.featureTypePropertyRepository, 'countActiveBlueprintAssignmentsByFeatureTypePropertyId')
        .resolves(0);
      const deleteStub = sinon.stub(service.featureTypePropertyRepository, 'deleteFeatureTypeProperty').resolves();

      await service.deleteFeatureTypeProperty(1, 10);

      expect(deleteStub).to.have.been.calledOnceWith(1, 10);
    });

    it('throws ApiConflictError when an active blueprint assignment references the pairing', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeatureTypePropertyService(mockConnection);

      sinon
        .stub(service.featureTypePropertyRepository, 'countActiveBlueprintAssignmentsByFeatureTypePropertyId')
        .resolves(2);
      const deleteStub = sinon.stub(service.featureTypePropertyRepository, 'deleteFeatureTypeProperty').resolves();

      try {
        await service.deleteFeatureTypeProperty(1, 10);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect((error as ApiConflictError).message).to.equal(
          'Feature type property is assigned by an active blueprint and cannot be retired'
        );
      }

      expect(deleteStub).to.not.have.been.called;
    });
  });
});
