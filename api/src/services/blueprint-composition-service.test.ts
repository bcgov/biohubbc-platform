import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError } from '../errors/api-error';
import { BlueprintCompositionService } from './blueprint-composition-service';
import { BlueprintFeatureTypePropertyService } from './blueprint-feature-type-property-service';
import { BlueprintFeatureTypeService } from './blueprint-feature-type-service';

const blueprint = {
  blueprint_id: 1,
  name: 'Draft',
  version_number: 1,
  description: null,
  is_default: false,
  parent_blueprint_id: null,
  record_effective_date: null,
  record_end_date: null
};
const type = {
  blueprint_feature_type_id: 2,
  blueprint_id: 1,
  feature_type_id: 3,
  name: 'type',
  display_name: 'Type',
  description: null,
  sort: null,
  record_end_date: null
};

describe('Blueprint composition service', () => {
  let service: BlueprintCompositionService;
  let types: sinon.SinonStubbedInstance<BlueprintFeatureTypeService>;
  let properties: sinon.SinonStubbedInstance<BlueprintFeatureTypePropertyService>;
  beforeEach(() => {
    service = new BlueprintCompositionService(getMockDBConnection());
    types = sinon.stub(service.blueprintFeatureTypeService);
    properties = sinon.stub(service.blueprintFeatureTypePropertyService);
    sinon.stub(service.blueprintService.blueprintRepository, 'lockBlueprintAdministration').resolves('2026-09-23');
    sinon.stub(service.blueprintService, 'getBlueprint').resolves(blueprint);
    types.getBlueprintFeatureType.resolves(type);
    sinon
      .stub(service.featureTypeService, 'getFeatureType')
      .resolves({ feature_type_id: 3, name: 'type', display_name: 'Type', description: null });
  });
  afterEach(() => sinon.restore());
  for (const state of [
    { record_effective_date: '2026-09-23' },
    { record_effective_date: '2026-09-22' },
    { record_end_date: '2026-09-23' }
  ]) {
    it(`rejects writes for read-only lifecycle ${JSON.stringify(state)}`, async () => {
      (service.blueprintService.getBlueprint as sinon.SinonStub).resolves({ ...blueprint, ...state });
      try {
        await service.createBlueprintFeatureType(1, { featureTypeId: 3 });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).instanceOf(ApiConflictError);
      }
      sinon.assert.notCalled(types.createBlueprintFeatureType);
    });
  }
  it('locks before validation and accepts a future blueprint', async () => {
    (service.blueprintService.getBlueprint as sinon.SinonStub).resolves({
      ...blueprint,
      record_effective_date: '2026-09-24'
    });
    types.createBlueprintFeatureType.resolves(type);
    await service.createBlueprintFeatureType(1, { featureTypeId: 3 });
    sinon.assert.callOrder(
      service.blueprintService.blueprintRepository.lockBlueprintAdministration as sinon.SinonStub,
      service.blueprintService.getBlueprint as sinon.SinonStub,
      types.createBlueprintFeatureType
    );
    sinon.assert.calledWithExactly(types.createBlueprintFeatureType, 1, { featureTypeId: 3 });
  });
  it('cascades with one date and leaves already retired assignments untouched', async () => {
    await service.deleteBlueprintFeatureType(1, 2);
    sinon.assert.callOrder(
      properties.deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId,
      types.deleteBlueprintFeatureType
    );
    sinon.assert.calledWithExactly(
      properties.deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId,
      2,
      '2026-09-23'
    );
    sinon.assert.calledWithExactly(types.deleteBlueprintFeatureType, 1, 2, '2026-09-23');
    types.getBlueprintFeatureType.resolves({ ...type, record_end_date: '2020-01-01' });
    properties.deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId.resetHistory();
    types.deleteBlueprintFeatureType.resetHistory();
    expect((await service.deleteBlueprintFeatureType(1, 2)).record_end_date).equal('2020-01-01');
    sinon.assert.notCalled(properties.deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId);
    sinon.assert.notCalled(types.deleteBlueprintFeatureType);
  });

  it('rejects cross-blueprint assignments before any mutation', async () => {
    types.getBlueprintFeatureType.rejects(new ApiNotFoundError('Not found'));
    try {
      await service.deleteBlueprintFeatureType(99, 2);
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiNotFoundError);
    }
    sinon.assert.calledWithExactly(types.getBlueprintFeatureType, 99, 2);
    sinon.assert.notCalled(properties.deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId);
  });
});
