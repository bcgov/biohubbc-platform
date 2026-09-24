import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError } from '../errors/api-error';
import { BlueprintFeatureTypePropertyService } from './blueprint-feature-type-property-service';

const assignment = {
  blueprint_feature_type_property_id: 4,
  blueprint_feature_type_id: 2,
  feature_property_id: 5,
  feature_type_name: 'observation',
  name: 'height',
  display_name: 'Height',
  description: null,
  type_name: 'number',
  required_value: false,
  allow_multiple: false,
  sort: null,
  record_end_date: null
};

describe('BlueprintFeatureTypePropertyService', () => {
  afterEach(() => sinon.restore());

  it('scopes both rows and counts to a validated parent assignment', async () => {
    const service = new BlueprintFeatureTypePropertyService(getMockDBConnection());
    sinon.stub(service.blueprintService, 'getBlueprint').resolves();
    const parent = sinon.stub(service.blueprintFeatureTypeService, 'getBlueprintFeatureType').resolves();
    const repository = sinon.stub(service.blueprintFeatureTypePropertyRepository);
    repository.getBlueprintFeatureTypeProperties.resolves([assignment]);
    repository.getBlueprintFeatureTypePropertiesCount.resolves({ count: 1 });
    const filters = { keyword: 'height', blueprintFeatureTypeId: 2 };
    const pagination = { page: 1, limit: 10 };
    const result = await service.getBlueprintFeatureTypeProperties(1, filters, pagination);
    expect(result.pagination.total).equal(1);
    sinon.assert.calledWithExactly(parent, 1, 2);
    sinon.assert.calledWithExactly(repository.getBlueprintFeatureTypeProperties, 1, filters, pagination);
    sinon.assert.calledWithExactly(repository.getBlueprintFeatureTypePropertiesCount, 1, filters);
  });

  it('rejects a cross-blueprint assignment before loading rows', async () => {
    const service = new BlueprintFeatureTypePropertyService(getMockDBConnection());
    sinon.stub(service.blueprintService, 'getBlueprint').resolves();
    sinon
      .stub(service.blueprintFeatureTypeService, 'getBlueprintFeatureType')
      .rejects(new ApiNotFoundError('Not found'));
    const repository = sinon.stub(service.blueprintFeatureTypePropertyRepository);
    try {
      await service.getBlueprintFeatureTypeProperties(1, { blueprintFeatureTypeId: 9 }, { page: 1, limit: 10 });
      expect.fail('Expected not found');
    } catch (error) {
      expect(error).instanceOf(ApiNotFoundError);
    }
    sinon.assert.notCalled(repository.getBlueprintFeatureTypeProperties);
  });

  it('defaults flags without sending assignment order to the creation boundary', async () => {
    const service = new BlueprintFeatureTypePropertyService(getMockDBConnection());
    const repository = sinon.stub(service.blueprintFeatureTypePropertyRepository);
    repository.getActiveBlueprintFeatureTypePropertyCount.resolves({ count: 0 });
    repository.getBlueprintFeatureTypePropertyById.resolves(assignment);
    const create = repository.insertBlueprintFeatureTypeProperty.resolves(4);
    await service.createBlueprintFeatureTypeProperty(1, { blueprintFeatureTypeId: 2, featurePropertyId: 5 });
    sinon.assert.calledWithExactly(create, {
      blueprint_feature_type_id: 2,
      feature_property_id: 5,
      required_value: false,
      allow_multiple: false
    });
  });

  it('rejects duplicate active membership before invoking creation', async () => {
    const service = new BlueprintFeatureTypePropertyService(getMockDBConnection());
    const repository = sinon.stub(service.blueprintFeatureTypePropertyRepository);
    repository.getActiveBlueprintFeatureTypePropertyCount.resolves({ count: 1 });
    const create = repository.insertBlueprintFeatureTypeProperty;
    try {
      await service.createBlueprintFeatureTypeProperty(1, { blueprintFeatureTypeId: 2, featurePropertyId: 5 });
      expect.fail('Expected conflict');
    } catch (error) {
      expect(error).instanceOf(ApiConflictError);
    }
    sinon.assert.notCalled(create);
  });

  it('preserves omission and sends explicit false settings to persistence', async () => {
    const service = new BlueprintFeatureTypePropertyService(getMockDBConnection());
    const repository = sinon.stub(service.blueprintFeatureTypePropertyRepository);
    repository.getBlueprintFeatureTypePropertyById.resolves(assignment);
    await service.updateBlueprintFeatureTypeProperty(1, 4, {});
    sinon.assert.notCalled(repository.updateBlueprintFeatureTypeProperty);
    await service.updateBlueprintFeatureTypeProperty(1, 4, { requiredValue: false });
    sinon.assert.calledWithExactly(repository.updateBlueprintFeatureTypeProperty, 1, 4, { requiredValue: false });
  });
});
