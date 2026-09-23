import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import {
  AdminBlueprint,
  AdminBlueprintFeatureType,
  AdminBlueprintFeatureTypeProperty,
  Blueprint
} from '../models/blueprint';
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
  beforeEach(() => {
    sinon.stub(BlueprintRepository.prototype, 'lockBlueprintAdministration').resolves('2026-09-23');
  });
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

const blueprint: Blueprint = {
  blueprint_id: 1,
  name: 'Schema',
  version_number: 1,
  description: null,
  is_default: false,
  parent_blueprint_id: null,
  record_effective_date: '2026-01-01',
  record_end_date: null
};

describe('BlueprintService administration', () => {
  let service: BlueprintService;
  let repository: sinon.SinonStubbedInstance<BlueprintService['blueprintRepository']>;
  beforeEach(() => {
    service = new BlueprintService(getMockDBConnection());
    repository = sinon.stub(service.blueprintRepository);
    repository.lockBlueprintAdministration.resolves('2026-09-23');
    repository.getBlueprint.resolves({ ...blueprint });
    repository.getBlueprintAncestorIds.resolves([2]);
  });
  afterEach(() => sinon.restore());

  it('locks creation before validating a retired parent and leaves an omitted date absent', async () => {
    repository.insertBlueprint.resolves({ ...blueprint, record_effective_date: null });
    const result = await service.createBlueprint({ name: 'Draft', parentBlueprintId: 2 });
    sinon.assert.callOrder(
      repository.lockBlueprintAdministration,
      repository.getBlueprintAncestorIds,
      repository.insertBlueprint
    );
    expect(repository.insertBlueprint.firstCall.args[0].recordEffectiveDate).to.be.undefined;
    expect(result.record_effective_date).to.be.null;
  });

  it('clears the old default before selecting the new default under the lock', async () => {
    repository.setDefaultBlueprint.resolves({ ...blueprint, is_default: true });
    expect((await service.setDefaultBlueprint(1)).is_default).to.equal(true);
    sinon.assert.callOrder(
      repository.lockBlueprintAdministration,
      repository.getBlueprint,
      repository.clearDefaultBlueprint,
      repository.setDefaultBlueprint
    );
  });

  for (const state of [
    { record_effective_date: null },
    { record_effective_date: '2026-09-24' },
    { record_end_date: '2026-09-01' },
    { record_effective_date: null, record_end_date: '2026-09-01' }
  ]) {
    it(`rejects default selection for ineligible state ${JSON.stringify(state)}`, async () => {
      repository.getBlueprint.resolves({ ...blueprint, ...state });
      try {
        await service.setDefaultBlueprint(1);
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
      sinon.assert.notCalled(repository.clearDefaultBlueprint);
    });
  }

  it('accepts today and makes repeated default selection a no-op', async () => {
    repository.getBlueprint.resolves({ ...blueprint, record_effective_date: '2026-09-23', is_default: true });
    await service.setDefaultBlueprint(1);
    sinon.assert.notCalled(repository.clearDefaultBlueprint);
    sinon.assert.notCalled(repository.setDefaultBlueprint);
  });

  for (const recordEffectiveDate of [null, '2026-09-24']) {
    it(`rejects an ineligible date on the current default: ${recordEffectiveDate}`, async () => {
      repository.getBlueprint.resolves({ ...blueprint, is_default: true });
      try {
        await service.updateBlueprint(1, { recordEffectiveDate });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
      sinon.assert.notCalled(repository.updateBlueprint);
    });
  }

  it('allows scheduled metadata edits and distinguishes omitted and null fields', async () => {
    repository.getBlueprint.resolves({ ...blueprint, record_effective_date: '2026-09-24' });
    await service.updateBlueprint(1, { name: 'Renamed', description: null, parentBlueprintId: null });
    expect(repository.updateBlueprint.firstCall.args[1]).to.deep.equal({
      name: 'Renamed',
      description: null,
      parentBlueprintId: null
    });
    sinon.assert.notCalled(repository.getBlueprintAncestorIds);
    sinon.assert.callOrder(repository.lockBlueprintAdministration, repository.getBlueprint, repository.updateBlueprint);
  });

  for (const record_effective_date of ['2026-09-22', '2026-09-23']) {
    it(`allows name and description edits once effective on ${record_effective_date}`, async () => {
      repository.getBlueprint.resolves({ ...blueprint, record_effective_date });
      await service.updateBlueprint(1, { name: 'Changed', description: null });
      sinon.assert.calledWithExactly(repository.updateBlueprint, 1, { name: 'Changed', description: null });
      sinon.assert.callOrder(
        repository.lockBlueprintAdministration,
        repository.getBlueprint,
        repository.updateBlueprint
      );
    });

    for (const fields of [
      { parentBlueprintId: null },
      { recordEffectiveDate: null },
      { recordEffectiveDate: '2999-01-01' }
    ]) {
      it(`rejects protected fields ${JSON.stringify(fields)} once effective on ${record_effective_date}`, async () => {
        repository.getBlueprint.resolves({ ...blueprint, record_effective_date });
        try {
          await service.updateBlueprint(1, { name: 'Changed', ...fields });
          expect.fail('Expected conflict');
        } catch (error) {
          expect(error).instanceOf(ApiConflictError);
        }
        sinon.assert.notCalled(repository.updateBlueprint);
      });
    }
  }

  it('rejects editing retired metadata', async () => {
    repository.getBlueprint.resolves({ ...blueprint, record_end_date: '2026-01-01' });
    try {
      await service.updateBlueprint(1, { name: 'Changed' });
      expect.fail('Expected conflict');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiConflictError);
    }
  });

  it('preserves the original retirement metadata on repeated calls', async () => {
    const retired = { ...blueprint, record_effective_date: null, record_end_date: '2026-01-01' };
    repository.getBlueprint.resolves(retired);
    expect(await service.retireBlueprint(1)).to.deep.equal(retired);
    sinon.assert.notCalled(repository.retireBlueprint);
  });

  for (const record_effective_date of [null, '2027-01-01', '2026-01-01']) {
    it(`allows retirement of non-default state ${record_effective_date}`, async () => {
      repository.getBlueprint.resolves({ ...blueprint, record_effective_date });
      await service.retireBlueprint(1);
      sinon.assert.calledOnceWithExactly(repository.retireBlueprint, 1);
    });
  }

  it('requires replacement before retiring the current default', async () => {
    repository.getBlueprint.resolves({ ...blueprint, is_default: true });
    try {
      await service.retireBlueprint(1);
      expect.fail('Expected conflict');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiConflictError);
    }
    sinon.assert.notCalled(repository.retireBlueprint);
  });

  for (const ancestorIds of [[1], [2, 1]]) {
    it('rejects self-parenting and cycles across ancestors', async () => {
      repository.getBlueprint.resolves({ ...blueprint, record_effective_date: null });
      repository.getBlueprintAncestorIds.resolves(ancestorIds);
      try {
        await service.updateBlueprint(1, { parentBlueprintId: ancestorIds[0] });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    });
  }

  it('rejects a missing parent', async () => {
    repository.getBlueprintAncestorIds.resolves([]);
    try {
      await service.createBlueprint({ name: 'Missing parent', parentBlueprintId: 99 });
      expect.fail('Expected validation error');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiValidationError);
    }
  });

  it('reports missing blueprint identifiers', async () => {
    repository.getBlueprint.resolves(undefined);
    try {
      await service.getBlueprint(99);
      expect.fail('Expected missing blueprint');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiNotFoundError);
    }
  });

  it('rejects unapproved sort fields before querying', async () => {
    try {
      await service.getBlueprints({}, { page: 1, limit: 10, sort: 'create_user' });
      expect.fail('Expected validation error');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiValidationError);
    }
    sinon.assert.notCalled(repository.getBlueprints);
  });

  it('returns the filtered count with all lifecycle states', async () => {
    repository.getBlueprints.resolves([{ ...blueprint, record_end_date: '2026-01-01' }]);
    repository.getBlueprintsCount.resolves({ count: 11 });
    const result = await service.getBlueprints({ keyword: 'schema' }, { page: 2, limit: 10, sort: 'name' });
    expect(result.pagination.total).to.equal(11);
    expect(result.blueprints[0].record_end_date).to.equal('2026-01-01');
    expect(repository.getBlueprintsCount.firstCall.args[0]).to.deep.equal({ keyword: 'schema' });
  });
});
