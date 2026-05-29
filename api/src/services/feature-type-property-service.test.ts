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
});
