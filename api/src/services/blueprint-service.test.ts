import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError } from '../errors/api-error';
import { AdminBlueprint, AdminBlueprintFeatureType, AdminBlueprintFeatureTypeProperty } from '../models/blueprint';
import { BlueprintRepository } from '../repositories/blueprint-repository';
import { FeaturePropertyRepository } from '../repositories/feature-property-repository';
import { FeatureTypeRepository } from '../repositories/feature-type-repository';
import { BlueprintService } from './blueprint-service';

chai.use(sinonChai);

const mockDraftBlueprint: AdminBlueprint = {
  blueprint_id: 8,
  version_number: 2,
  name: 'Default Blueprint',
  description: null,
  is_default: false,
  parent_blueprint_id: 7,
  record_effective_date: null,
  record_end_date: null
};

const mockPublishedBlueprint: AdminBlueprint = {
  ...mockDraftBlueprint,
  blueprint_id: 7,
  version_number: 1,
  is_default: true,
  parent_blueprint_id: null,
  record_effective_date: '2026-06-16'
};

const mockBlueprintFeatureType: AdminBlueprintFeatureType = {
  blueprint_feature_type_id: 5,
  blueprint_id: 8,
  feature_type_id: 10,
  feature_type_name: 'species_observation',
  feature_type_display_name: 'Species Observation',
  sort: null
};

const mockBlueprintFeatureTypeProperty: AdminBlueprintFeatureTypeProperty = {
  blueprint_feature_type_property_id: 3,
  blueprint_feature_type_id: 5,
  feature_property_id: 20,
  property_name: 'latitude',
  property_display_name: 'Latitude',
  property_type_name: 'number',
  required_value: true,
  allow_multiple: true,
  sort: 1
};

describe('BlueprintService', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('instantiates repository fields in the constructor', () => {
    const service = new BlueprintService(getMockDBConnection());

    expect(service.blueprintRepository).to.be.instanceof(BlueprintRepository);
    expect(service.featureTypeRepository).to.be.instanceof(FeatureTypeRepository);
    expect(service.featurePropertyRepository).to.be.instanceof(FeaturePropertyRepository);
  });

  describe('createBlueprintVersion', () => {
    it('copies the source blueprint and returns the new draft', async () => {
      const service = new BlueprintService(getMockDBConnection());

      const createStub = sinon.stub(service.blueprintRepository, 'createBlueprintVersionFromBlueprint').resolves(8);
      const getStub = sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);

      const result = await service.createBlueprintVersion(7, { name: 'Next' });

      expect(createStub).to.have.been.calledOnceWith(7, { name: 'Next' });
      expect(getStub).to.have.been.calledOnceWith(8);
      expect(result).to.eql(mockDraftBlueprint);
    });

    it('can be created from a published blueprint', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'createBlueprintVersionFromBlueprint').resolves(8);
      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);

      const result = await service.createBlueprintVersion(mockPublishedBlueprint.blueprint_id, {});

      expect(result.parent_blueprint_id).to.equal(7);
    });
  });

  describe('publishBlueprint', () => {
    it('publishes a draft without touching the current default', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      const clearStub = sinon.stub(service.blueprintRepository, 'clearDefaultBlueprint').resolves();
      const publishStub = sinon.stub(service.blueprintRepository, 'publishBlueprint').resolves();

      await service.publishBlueprint(8, {});

      expect(clearStub).to.not.have.been.called;
      expect(publishStub).to.have.been.calledOnceWith(8, false);
    });

    it('clears the current default before publishing as the default', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      const clearStub = sinon.stub(service.blueprintRepository, 'clearDefaultBlueprint').resolves();
      const publishStub = sinon.stub(service.blueprintRepository, 'publishBlueprint').resolves();

      await service.publishBlueprint(8, { is_default: true });

      expect(publishStub).to.have.been.calledOnceWith(8, true);
      expect(clearStub).to.have.been.calledBefore(publishStub);
    });

    it('throws ApiConflictError when the blueprint is already published', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockPublishedBlueprint);
      const publishStub = sinon.stub(service.blueprintRepository, 'publishBlueprint').resolves();

      try {
        await service.publishBlueprint(7, {});
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(publishStub).to.not.have.been.called;
    });
  });

  describe('createBlueprintFeatureType', () => {
    it('includes the feature type in a draft blueprint', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      sinon.stub(service.featureTypeRepository, 'getFeatureType').resolves({ feature_type_id: 10 } as any);
      sinon.stub(service.blueprintRepository, 'findActiveBlueprintFeatureType').resolves(null);
      const insertStub = sinon.stub(service.blueprintRepository, 'insertBlueprintFeatureType').resolves(5);
      sinon.stub(service.blueprintRepository, 'getAdminBlueprintFeatureType').resolves(mockBlueprintFeatureType);

      const result = await service.createBlueprintFeatureType(8, { feature_type_id: 10, sort: 2 });

      expect(insertStub).to.have.been.calledOnceWith({ blueprint_id: 8, feature_type_id: 10, sort: 2 });
      expect(result).to.eql(mockBlueprintFeatureType);
    });

    it('throws ApiConflictError when the blueprint already includes the feature type', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      sinon.stub(service.featureTypeRepository, 'getFeatureType').resolves({ feature_type_id: 10 } as any);
      sinon
        .stub(service.blueprintRepository, 'findActiveBlueprintFeatureType')
        .resolves({ blueprint_feature_type_id: 5 });
      const insertStub = sinon.stub(service.blueprintRepository, 'insertBlueprintFeatureType').resolves(5);

      try {
        await service.createBlueprintFeatureType(8, { feature_type_id: 10 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(insertStub).to.not.have.been.called;
    });

    it('throws ApiConflictError when the blueprint is published', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockPublishedBlueprint);
      const insertStub = sinon.stub(service.blueprintRepository, 'insertBlueprintFeatureType').resolves(5);

      try {
        await service.createBlueprintFeatureType(7, { feature_type_id: 10 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(insertStub).to.not.have.been.called;
    });
  });

  describe('deleteBlueprintFeatureType', () => {
    it('retires the feature type and then its property assignments', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      const deleteStub = sinon.stub(service.blueprintRepository, 'deleteBlueprintFeatureType').resolves();
      const deletePropertiesStub = sinon
        .stub(service.blueprintRepository, 'deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId')
        .resolves();

      await service.deleteBlueprintFeatureType(8, 5);

      expect(deleteStub).to.have.been.calledOnceWith(5, 8);
      expect(deletePropertiesStub).to.have.been.calledOnceWith(5);
      expect(deleteStub).to.have.been.calledBefore(deletePropertiesStub);
    });

    it('leaves the assignments untouched when the feature type is not in the blueprint', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      sinon
        .stub(service.blueprintRepository, 'deleteBlueprintFeatureType')
        .rejects(new ApiNotFoundError('Blueprint feature type not found'));
      const deletePropertiesStub = sinon
        .stub(service.blueprintRepository, 'deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId')
        .resolves();

      try {
        await service.deleteBlueprintFeatureType(8, 999);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(deletePropertiesStub).to.not.have.been.called;
    });
  });

  describe('createBlueprintFeatureTypeProperty', () => {
    /**
     * Stub the lookups that precede the insert, for a draft blueprint and an unassigned property.
     *
     * @param {BlueprintService} service
     */
    const stubUnassignedPropertyOnDraft = (service: BlueprintService) => {
      sinon.stub(service.blueprintRepository, 'getAdminBlueprintFeatureType').resolves(mockBlueprintFeatureType);
      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      sinon.stub(service.featurePropertyRepository, 'getFeatureProperty').resolves({ feature_property_id: 20 } as any);
      sinon.stub(service.blueprintRepository, 'findActiveBlueprintFeatureTypeProperty').resolves(null);
      sinon
        .stub(service.blueprintRepository, 'getAdminBlueprintFeatureTypeProperty')
        .resolves(mockBlueprintFeatureTypeProperty);
    };

    it('inserts the assignment with the requested configuration', async () => {
      const service = new BlueprintService(getMockDBConnection());
      stubUnassignedPropertyOnDraft(service);

      const insertStub = sinon.stub(service.blueprintRepository, 'insertBlueprintFeatureTypeProperty').resolves(3);

      const result = await service.createBlueprintFeatureTypeProperty(8, 5, {
        feature_property_id: 20,
        required_value: true,
        allow_multiple: true,
        sort: 1
      });

      // Requiredness, multiplicity and ordering live on the assignment; the caller names only the property.
      expect(insertStub).to.have.been.calledOnceWith({
        blueprint_feature_type_id: 5,
        feature_property_id: 20,
        required_value: true,
        allow_multiple: true,
        sort: 1
      });
      expect(result).to.eql(mockBlueprintFeatureTypeProperty);
    });

    it('throws ApiConflictError when the property is already assigned to the blueprint feature type', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprintFeatureType').resolves(mockBlueprintFeatureType);
      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      sinon.stub(service.featurePropertyRepository, 'getFeatureProperty').resolves({ feature_property_id: 20 } as any);
      sinon
        .stub(service.blueprintRepository, 'findActiveBlueprintFeatureTypeProperty')
        .resolves({ blueprint_feature_type_property_id: 3 });
      const insertStub = sinon.stub(service.blueprintRepository, 'insertBlueprintFeatureTypeProperty');

      try {
        await service.createBlueprintFeatureTypeProperty(8, 5, { feature_property_id: 20 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect((error as ApiConflictError).message).to.equal(
          'Feature property is already assigned to this blueprint feature type'
        );
      }

      expect(insertStub).to.not.have.been.called;
    });

    it('throws ApiConflictError when the blueprint is published', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon
        .stub(service.blueprintRepository, 'getAdminBlueprintFeatureType')
        .resolves({ ...mockBlueprintFeatureType, blueprint_id: 7 });
      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockPublishedBlueprint);
      const insertStub = sinon.stub(service.blueprintRepository, 'insertBlueprintFeatureTypeProperty');

      try {
        await service.createBlueprintFeatureTypeProperty(7, 5, { feature_property_id: 20 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect((error as ApiConflictError).message).to.equal(
          'Blueprint is published and cannot be changed; create a new version'
        );
      }

      expect(insertStub).to.not.have.been.called;
    });

    it('throws ApiNotFoundError when the blueprint feature type is not in the blueprint', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon
        .stub(service.blueprintRepository, 'getAdminBlueprintFeatureType')
        .rejects(new ApiNotFoundError('Blueprint feature type not found'));
      const insertStub = sinon.stub(service.blueprintRepository, 'insertBlueprintFeatureTypeProperty');

      try {
        await service.createBlueprintFeatureTypeProperty(8, 999, { feature_property_id: 20 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(insertStub).to.not.have.been.called;
    });

    it('throws ApiNotFoundError when the feature property does not exist', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprintFeatureType').resolves(mockBlueprintFeatureType);
      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      sinon
        .stub(service.featurePropertyRepository, 'getFeatureProperty')
        .rejects(new ApiNotFoundError('Feature property not found'));
      const insertStub = sinon.stub(service.blueprintRepository, 'insertBlueprintFeatureTypeProperty');

      try {
        await service.createBlueprintFeatureTypeProperty(8, 5, { feature_property_id: 999 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(insertStub).to.not.have.been.called;
    });
  });

  describe('updateBlueprintFeatureTypeProperty', () => {
    it('updates the assignment of a draft blueprint', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprintFeatureType').resolves(mockBlueprintFeatureType);
      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      const updateStub = sinon.stub(service.blueprintRepository, 'updateBlueprintFeatureTypeProperty').resolves();
      sinon
        .stub(service.blueprintRepository, 'getAdminBlueprintFeatureTypeProperty')
        .resolves(mockBlueprintFeatureTypeProperty);

      const result = await service.updateBlueprintFeatureTypeProperty(8, 5, 3, { required_value: false });

      expect(updateStub).to.have.been.calledOnceWith(3, 5, { required_value: false });
      expect(result).to.eql(mockBlueprintFeatureTypeProperty);
    });

    it('throws ApiConflictError when the blueprint is published', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprintFeatureType').resolves(mockBlueprintFeatureType);
      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockPublishedBlueprint);
      const updateStub = sinon.stub(service.blueprintRepository, 'updateBlueprintFeatureTypeProperty').resolves();

      try {
        await service.updateBlueprintFeatureTypeProperty(7, 5, 3, { required_value: false });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(updateStub).to.not.have.been.called;
    });
  });

  describe('deleteBlueprintFeatureTypeProperty', () => {
    it('retires the assignment of a draft blueprint', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprintFeatureType').resolves(mockBlueprintFeatureType);
      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockDraftBlueprint);
      const deleteStub = sinon.stub(service.blueprintRepository, 'deleteBlueprintFeatureTypeProperty').resolves();

      await service.deleteBlueprintFeatureTypeProperty(8, 5, 3);

      expect(deleteStub).to.have.been.calledOnceWith(3, 5);
    });

    it('throws ApiConflictError when the blueprint is published', async () => {
      const service = new BlueprintService(getMockDBConnection());

      sinon.stub(service.blueprintRepository, 'getAdminBlueprintFeatureType').resolves(mockBlueprintFeatureType);
      sinon.stub(service.blueprintRepository, 'getAdminBlueprint').resolves(mockPublishedBlueprint);
      const deleteStub = sinon.stub(service.blueprintRepository, 'deleteBlueprintFeatureTypeProperty').resolves();

      try {
        await service.deleteBlueprintFeatureTypeProperty(7, 5, 3);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(deleteStub).to.not.have.been.called;
    });
  });

  describe('getAdminBlueprintFeatureTypeProperties', () => {
    it('scopes the blueprint feature type to the blueprint before listing', async () => {
      const service = new BlueprintService(getMockDBConnection());

      const scopeStub = sinon
        .stub(service.blueprintRepository, 'getAdminBlueprintFeatureType')
        .rejects(new ApiNotFoundError('Blueprint feature type not found'));
      const listStub = sinon.stub(service.blueprintRepository, 'getAdminBlueprintFeatureTypeProperties');

      try {
        await service.getAdminBlueprintFeatureTypeProperties(8, 999);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(scopeStub).to.have.been.calledOnceWith(999, 8);
      expect(listStub).to.not.have.been.called;
    });
  });
});
