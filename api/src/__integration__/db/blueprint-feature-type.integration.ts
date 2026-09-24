import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { BlueprintCompositionService } from '../../services/blueprint-composition-service';
import { BlueprintService } from '../../services/blueprint-service';
import { FeaturePropertyService } from '../../services/feature-property-service';
import { FeatureTypeService } from '../../services/feature-type-service';

/**
 * Real database coverage of membership scope, history, selector pagination, and rollback.
 */
describe('Blueprint feature types (integration)', function () {
  this.timeout(20000);
  let connection: IDBConnection;
  let service: BlueprintCompositionService;
  let blueprints: BlueprintService;
  let blueprintId: number;
  let otherBlueprintId: number;
  let featureTypeId: number;
  let featurePropertyId: number;
  const pagination = { page: 1, limit: 1, sort: 'name' };
  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new BlueprintCompositionService(connection);
    blueprints = new BlueprintService(connection);
    blueprintId = (await blueprints.createBlueprint({ name: randomUUID() })).blueprint_id;
    otherBlueprintId = (await blueprints.createBlueprint({ name: randomUUID() })).blueprint_id;
    const featureTypes = new FeatureTypeService(connection);
    featureTypeId = (await featureTypes.createFeatureType({ name: randomUUID(), display_name: 'Composition type' }))
      .feature_type_id;
    const featureProperties = new FeaturePropertyService(connection);
    const types = await featureProperties.getFeaturePropertyTypes();
    featurePropertyId = (
      await featureProperties.createFeatureProperty({
        name: randomUUID(),
        display_name: 'Composition property',
        feature_property_type_id: types.feature_property_types.find((row) => row.name === 'string')!
          .feature_property_type_id
      })
    ).feature_property_id;
  });
  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });
  it('excludes assigned feature types before pagination and permits reassignment after deletion', async () => {
    const definition = await service.featureTypeService.getFeatureType(featureTypeId);
    const available = await service.getAvailableFeatureTypesForBlueprint(blueprintId, definition.name, pagination);
    expect(available.pagination.total).equal(1);
    expect(available.options[0].id).equal(featureTypeId);
    const assignment = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    const excluded = await service.getAvailableFeatureTypesForBlueprint(blueprintId, definition.name, pagination);
    expect(excluded.pagination.total).equal(0);
    expect(excluded.options).to.be.empty;
    await service.deleteBlueprintFeatureType(blueprintId, assignment.blueprint_feature_type_id);
    const deleted = await service.blueprintFeatureTypeService.getBlueprintFeatureTypes(blueprintId, {}, pagination);
    expect(deleted.types).to.be.empty;
    expect(deleted.pagination.total).equal(0);
    const replacement = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    expect(replacement.blueprint_feature_type_id).not.equal(assignment.blueprint_feature_type_id);
  });
  it('treats today as effective and permits future creation', async () => {
    await blueprints.updateBlueprint(blueprintId, { recordEffectiveDate: '2999-01-01' });
    const a = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    const date = await blueprints.blueprintRepository.lockBlueprintAdministration();
    await blueprints.updateBlueprint(blueprintId, { recordEffectiveDate: date });
    try {
      await service.deleteBlueprintFeatureType(blueprintId, a.blueprint_feature_type_id);
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiConflictError);
    }
  });
  it('serializes competing creates and revalidates duplicate membership after commit', async () => {
    await connection.commit();
    const competing = getAPIUserDBConnection();
    await competing.open();
    const competingService = new BlueprintCompositionService(competing);
    try {
      await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
      const pending = competingService.createBlueprintFeatureType(blueprintId, { featureTypeId });
      await connection.commit();
      try {
        await pending;
        expect.fail('Expected duplicate conflict');
      } catch (error) {
        expect(error).instanceOf(ApiConflictError);
      }
    } finally {
      await competing.rollback();
      competing.release();
      await connection.sql(
        SQL`DELETE FROM blueprint_feature_type WHERE blueprint_id IN (${blueprintId}, ${otherBlueprintId})`
      );
      await connection.sql(SQL`DELETE FROM blueprint WHERE blueprint_id IN (${blueprintId}, ${otherBlueprintId})`);
      await connection.sql(SQL`DELETE FROM feature_type WHERE feature_type_id = ${featureTypeId}`);
      await connection.sql(SQL`DELETE FROM feature_property WHERE feature_property_id = ${featurePropertyId}`);
      await connection.commit();
    }
  });
});
