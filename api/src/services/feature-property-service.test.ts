import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { FeatureProperty } from '../models/feature-property';
import { FeaturePropertyService } from './feature-property-service';

chai.use(sinonChai);

const mockFeatureProperty: FeatureProperty = {
  feature_property_id: 1,
  feature_property_type_id: 2,
  name: 'guid',
  display_name: 'GUID',
  description: null,
  type_name: 'string',
  calculated_value: false
};

describe('FeaturePropertyService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createFeatureProperty', () => {
    it('validates the feature_property_type_id and returns the created property', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeaturePropertyService(mockConnection);

      sinon
        .stub(service.featurePropertyRepository, 'getFeaturePropertyTypeById')
        .resolves({ feature_property_type_id: 2 });
      sinon.stub(service.featurePropertyRepository, 'insertFeatureProperty').resolves(1);
      sinon.stub(service.featurePropertyRepository, 'getFeatureProperty').resolves(mockFeatureProperty);

      const result = await service.createFeatureProperty({
        feature_property_type_id: 2,
        name: 'guid',
        display_name: 'GUID'
      });

      expect(result).to.eql(mockFeatureProperty);
      expect(service.featurePropertyRepository.getFeaturePropertyTypeById).to.have.been.calledOnceWith(2);
    });

    it('throws ApiNotFoundError when the feature_property_type_id does not exist', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeaturePropertyService(mockConnection);

      sinon
        .stub(service.featurePropertyRepository, 'getFeaturePropertyTypeById')
        .rejects(new ApiNotFoundError('Feature property type not found', []));

      try {
        await service.createFeatureProperty({
          feature_property_type_id: 999,
          name: 'guid',
          display_name: 'GUID'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('updateFeatureProperty', () => {
    it('updates the property and returns the refreshed record (without changing type)', async () => {
      const mockConnection = getMockDBConnection();
      const service = new FeaturePropertyService(mockConnection);

      const updatedProperty: FeatureProperty = { ...mockFeatureProperty, display_name: 'Updated GUID' };
      sinon.stub(service.featurePropertyRepository, 'updateFeatureProperty').resolves();
      sinon.stub(service.featurePropertyRepository, 'getFeatureProperty').resolves(updatedProperty);

      const result = await service.updateFeatureProperty(1, { display_name: 'Updated GUID' });

      expect(result).to.eql(updatedProperty);
      expect(service.featurePropertyRepository.updateFeatureProperty).to.have.been.calledOnceWith(1, {
        display_name: 'Updated GUID'
      });
    });
  });
});
