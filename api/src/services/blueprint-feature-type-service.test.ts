import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError } from '../errors/api-error';
import { BlueprintFeatureTypeService } from './blueprint-feature-type-service';

const assignment = {
  blueprint_feature_type_id: 2,
  blueprint_id: 1,
  feature_type_id: 3,
  name: 'observation',
  display_name: 'Observation',
  description: null,
  sort: null,
  record_end_date: null
};

describe('BlueprintFeatureTypeService', () => {
  afterEach(() => sinon.restore());

  it('pairs filtered rows and counts without acquiring a write lock', async () => {
    const service = new BlueprintFeatureTypeService(getMockDBConnection());
    sinon.stub(service.blueprintService, 'getBlueprint').resolves();
    const repository = sinon.stub(service.blueprintFeatureTypeRepository);
    repository.getBlueprintFeatureTypes.resolves([assignment]);
    repository.getBlueprintFeatureTypesCount.resolves({ count: 7 });
    const filters = { keyword: 'Observation' };
    const pagination = { page: 2, limit: 2, sort: 'name' };
    const result = await service.getBlueprintFeatureTypes(1, filters, pagination);
    expect(result.types).deep.equal([assignment]);
    expect(result.pagination.total).equal(7);
    sinon.assert.calledWithExactly(repository.getBlueprintFeatureTypes, 1, filters, pagination);
    sinon.assert.calledWithExactly(repository.getBlueprintFeatureTypesCount, 1, filters);
  });

  it('creates membership without writing assignment order', async () => {
    const service = new BlueprintFeatureTypeService(getMockDBConnection());
    const repository = sinon.stub(service.blueprintFeatureTypeRepository);
    repository.getActiveBlueprintFeatureTypeCount.resolves({ count: 0 });
    repository.insertBlueprintFeatureType.resolves(2);
    repository.getBlueprintFeatureTypeById.resolves(assignment);
    expect(await service.createBlueprintFeatureType(1, { featureTypeId: 3 })).deep.equal(assignment);
    sinon.assert.calledWithExactly(repository.insertBlueprintFeatureType, 1, 3);
  });

  it('rejects duplicate active membership before inserting', async () => {
    const service = new BlueprintFeatureTypeService(getMockDBConnection());
    const repository = sinon.stub(service.blueprintFeatureTypeRepository);
    repository.getActiveBlueprintFeatureTypeCount.resolves({ count: 1 });
    try {
      await service.createBlueprintFeatureType(1, { featureTypeId: 3 });
      expect.fail('Expected conflict');
    } catch (error) {
      expect(error).instanceOf(ApiConflictError);
    }
    sinon.assert.notCalled(repository.insertBlueprintFeatureType);
  });
});
