import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError, ApiNotFoundError } from '../../errors/api-error';
import { BlueprintCompositionService } from '../../services/blueprint-composition-service';
import { BlueprintService } from '../../services/blueprint-service';
import { BlueprintVersionService } from '../../services/blueprint-version-service';
import { FeaturePropertyService } from '../../services/feature-property-service';
import { FeatureTypeService } from '../../services/feature-type-service';
import { createBlueprintFeatureTypeProperty } from '../helpers/test-feature-property-helpers';
import { getActiveDefaultBlueprintId } from '../helpers/test-submission-helpers';

/**
 * Real database coverage of membership scope, history, selector pagination, and rollback.
 */
describe('Blueprint composition (integration)', function () {
  this.timeout(20000);
  let connection: IDBConnection;
  let service: BlueprintCompositionService;
  let blueprints: BlueprintService;
  let versions: BlueprintVersionService;
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
    versions = new BlueprintVersionService(connection);
    blueprintId = (await versions.createBlueprint({ name: randomUUID() })).blueprint_id;
    otherBlueprintId = (await versions.createBlueprint({ name: randomUUID() })).blueprint_id;
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
  it('copies allowed reference targets when creating a blueprint from a parent', async () => {
    const source = await createBlueprintFeatureTypeProperty(connection, 'capture', ['dataset', 'survey']);
    const parentBlueprintId = await getActiveDefaultBlueprintId(connection);
    const copy = await versions.createBlueprint({ name: randomUUID(), parentBlueprintId });
    const copied = await connection.sql(SQL`
      SELECT reference.blueprint_feature_type_property_id, reference.target_feature_type_id
      FROM feature_type_property_feature reference
      JOIN blueprint_feature_type_property property USING (blueprint_feature_type_property_id)
      JOIN blueprint_feature_type type USING (blueprint_feature_type_id)
      WHERE type.blueprint_id = ${copy.blueprint_id} AND property.feature_property_id = ${source.featurePropertyId}
    `);
    expect(copied.rows.map((row) => row.target_feature_type_id)).to.have.members(source.allowedFeatureTypeIds);
    for (const row of copied.rows) {
      expect(row.blueprint_feature_type_property_id).not.to.equal(source.blueprintFeatureTypePropertyId);
    }
  });

  it('copies allowed reference targets when creating a new blueprint version', async () => {
    const source = await createBlueprintFeatureTypeProperty(connection, 'capture', ['dataset', 'survey']);
    const parentBlueprintId = await getActiveDefaultBlueprintId(connection);
    const copy = await versions.createBlueprintVersion(parentBlueprintId, { name: randomUUID() });
    const copied = await connection.sql(SQL`
      SELECT reference.blueprint_feature_type_property_id, reference.target_feature_type_id
      FROM feature_type_property_feature reference
      JOIN blueprint_feature_type_property property USING (blueprint_feature_type_property_id)
      JOIN blueprint_feature_type type USING (blueprint_feature_type_id)
      WHERE type.blueprint_id = ${copy.blueprint_id} AND property.feature_property_id = ${source.featurePropertyId}
    `);
    expect(copied.rows.map((row) => row.target_feature_type_id)).to.have.members(source.allowedFeatureTypeIds);
    for (const row of copied.rows) {
      expect(row.blueprint_feature_type_property_id).not.to.equal(source.blueprintFeatureTypePropertyId);
    }
  });

  it('copies non-deleted memberships from a retired parent with new identities', async () => {
    const historical = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    const historicalProperty = await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: historical.blueprint_feature_type_id,
      featurePropertyId,
      requiredValue: true,
      allowMultiple: true
    });
    await service.deleteBlueprintFeatureType(blueprintId, historical.blueprint_feature_type_id);
    const current = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    const currentProperty = await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: current.blueprint_feature_type_id,
      featurePropertyId
    });
    await blueprints.retireBlueprint(blueprintId);
    const copy = await versions.createBlueprint({ name: randomUUID(), parentBlueprintId: blueprintId });
    expect(copy.record_effective_date).to.be.null;
    const copiedTypes = await service.blueprintFeatureTypeService.getBlueprintFeatureTypes(
      copy.blueprint_id,
      {},
      { page: 1, limit: 10 }
    );
    const copiedProperties = await service.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperties(
      copy.blueprint_id,
      {},
      { page: 1, limit: 10 }
    );
    expect(copiedTypes.types).to.have.length(1);
    expect(copiedTypes.pagination.total).to.equal(1);
    expect(copiedProperties.properties).to.have.length(1);
    expect(copiedProperties.pagination.total).to.equal(1);
    const allCopied = await connection.sql(SQL`
      SELECT t.blueprint_feature_type_id, t.record_end_date AS type_end_date,
        p.blueprint_feature_type_property_id, p.record_end_date AS property_end_date,
        p.required_value, p.allow_multiple
      FROM blueprint_feature_type t
      JOIN blueprint_feature_type_property p USING (blueprint_feature_type_id)
      WHERE t.blueprint_id = ${copy.blueprint_id}
    `);
    expect(allCopied.rows).to.have.length(1);
    for (const row of allCopied.rows) {
      expect(row.blueprint_feature_type_id).not.to.be.oneOf([
        historical.blueprint_feature_type_id,
        current.blueprint_feature_type_id
      ]);
      expect(row.blueprint_feature_type_property_id).not.to.be.oneOf([
        historicalProperty.blueprint_feature_type_property_id,
        currentProperty.blueprint_feature_type_property_id
      ]);
      expect(row.property_end_date).to.deep.equal(row.type_end_date);
      expect(row.required_value).to.equal(row.type_end_date !== null);
      expect(row.allow_multiple).to.equal(row.type_end_date !== null);
    }
    const original = await service.blueprintFeatureTypeService.getBlueprintFeatureTypes(
      blueprintId,
      {},
      { page: 1, limit: 10 }
    );
    expect(original.types.map((row) => row.blueprint_feature_type_id)).to.deep.equal([
      current.blueprint_feature_type_id
    ]);
  });

  it('establishes independent property memberships and rejects only same-parent active duplicates', async () => {
    const a = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    const b = await service.createBlueprintFeatureType(otherBlueprintId, { featureTypeId });
    const assigned = await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: a.blueprint_feature_type_id,
      featurePropertyId,
      requiredValue: true
    });
    expect(
      (
        await service.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperties(
          otherBlueprintId,
          {},
          pagination
        )
      ).properties
    ).deep.equal([]);
    const other = await service.createBlueprintFeatureTypeProperty(otherBlueprintId, {
      blueprintFeatureTypeId: b.blueprint_feature_type_id,
      featurePropertyId,
      requiredValue: false
    });
    expect(assigned.required_value).equal(true);
    expect(other.required_value).equal(false);
    try {
      await service.createBlueprintFeatureTypeProperty(blueprintId, {
        blueprintFeatureTypeId: a.blueprint_feature_type_id,
        featurePropertyId
      });
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiConflictError);
    }
  });
  it('filters property rows and counts by assignment before pagination', async () => {
    const first = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: first.blueprint_feature_type_id,
      featurePropertyId
    });
    const featureTypes = new FeatureTypeService(connection);
    const secondDefinition = await featureTypes.createFeatureType({ name: randomUUID(), display_name: 'Second type' });
    const second = await service.createBlueprintFeatureType(blueprintId, {
      featureTypeId: secondDefinition.feature_type_id
    });
    const assigned = await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: second.blueprint_feature_type_id,
      featurePropertyId
    });
    const filtered = await service.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperties(
      blueprintId,
      {
        blueprintFeatureTypeId: second.blueprint_feature_type_id,
        keyword: 'Composition'
      },
      pagination
    );
    expect(filtered.pagination.total).equal(1);
    expect(filtered.properties.map((row) => row.blueprint_feature_type_property_id)).deep.equal([
      assigned.blueprint_feature_type_property_id
    ]);
    try {
      await service.blueprintFeatureTypeService.getBlueprintFeatureType(
        otherBlueprintId,
        second.blueprint_feature_type_id
      );
      expect.fail('Expected ownership rejection');
    } catch (error) {
      expect(error).instanceOf(ApiNotFoundError);
    }
  });

  it('filters contextual selectors before pagination with matching counts', async () => {
    const a = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    const definition = await service.featurePropertyService.getFeatureProperty(featurePropertyId);
    const before = await service.getAvailableFeaturePropertiesForBlueprintFeatureType(
      blueprintId,
      a.blueprint_feature_type_id,
      definition.name.toUpperCase(),
      pagination
    );
    expect(before.pagination.total).equal(1);
    expect(before.options[0].id).equal(featurePropertyId);
    await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: a.blueprint_feature_type_id,
      featurePropertyId
    });
    const after = await service.getAvailableFeaturePropertiesForBlueprintFeatureType(
      blueprintId,
      a.blueprint_feature_type_id,
      definition.name,
      pagination
    );
    expect(after.pagination.total).equal(0);
    expect(after.options).deep.equal([]);
    const typeOptions = await service.getAvailableFeatureTypesForBlueprint(blueprintId, a.name, pagination);
    expect(typeOptions.pagination.total).equal(0);
  });
  it('retires active children before parents, preserves earlier end dates, and creates new identities on reassignment', async () => {
    const a = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    const p = await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: a.blueprint_feature_type_id,
      featurePropertyId
    });
    const ended = await service.deleteBlueprintFeatureTypeProperty(blueprintId, p.blueprint_feature_type_property_id);
    const next = await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: a.blueprint_feature_type_id,
      featurePropertyId
    });
    expect(next.blueprint_feature_type_property_id).not.equal(p.blueprint_feature_type_property_id);
    const retiredType = await service.deleteBlueprintFeatureType(blueprintId, a.blueprint_feature_type_id);
    expect(await service.deleteBlueprintFeatureType(blueprintId, a.blueprint_feature_type_id)).deep.equal(retiredType);
    const history = await service.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperties(
      blueprintId,
      {},
      { page: 1, limit: 25 }
    );
    expect(history.properties).to.deep.equal([]);
    expect(history.pagination.total).to.equal(0);
    const historicalProperty = await service.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperty(
      blueprintId,
      p.blueprint_feature_type_property_id
    );
    const deletedProperty = await service.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperty(
      blueprintId,
      next.blueprint_feature_type_property_id
    );
    expect(historicalProperty.record_end_date).to.equal(ended.record_end_date);
    expect(deletedProperty.record_end_date).to.equal(retiredType.record_end_date);
    const replacement = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    expect(replacement.blueprint_feature_type_id).not.equal(a.blueprint_feature_type_id);
    expect(
      (await service.blueprintFeatureTypeService.getBlueprintFeatureTypes(blueprintId, { active: true }, pagination))
        .types[0].blueprint_feature_type_id
    ).equal(replacement.blueprint_feature_type_id);
  });
  it('returns persisted assignment order without changing it during settings edits', async () => {
    const type = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    const property = await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: type.blueprint_feature_type_id,
      featurePropertyId
    });
    await connection.sql(
      SQL`UPDATE blueprint_feature_type SET sort = 7 WHERE blueprint_feature_type_id = ${type.blueprint_feature_type_id}`
    );
    await connection.sql(
      SQL`UPDATE blueprint_feature_type_property SET sort = 8 WHERE blueprint_feature_type_property_id = ${property.blueprint_feature_type_property_id}`
    );
    const updated = await service.updateBlueprintFeatureTypeProperty(
      blueprintId,
      property.blueprint_feature_type_property_id,
      { requiredValue: true }
    );
    expect(updated.sort).equal(8);
    const types = await service.blueprintFeatureTypeService.getBlueprintFeatureTypes(blueprintId, {}, pagination);
    const properties = await service.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperties(
      blueprintId,
      {},
      pagination
    );
    expect(types.types[0].sort).equal(7);
    expect(properties.properties[0].sort).equal(8);
  });

  it('rejects cross-blueprint identifiers and preserves global definitions', async () => {
    const a = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    try {
      await service.deleteBlueprintFeatureType(otherBlueprintId, a.blueprint_feature_type_id);
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiNotFoundError);
    }
    const global = await connection.sql(
      SQL`SELECT record_end_date FROM feature_type WHERE feature_type_id = ${featureTypeId}`
    );
    expect(global.rows[0].record_end_date).to.be.null;
  });
  it('continues reading ended global definitions while rejecting new assignments', async () => {
    const a = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: a.blueprint_feature_type_id,
      featurePropertyId
    });
    await connection.sql(
      SQL`UPDATE feature_property SET record_end_date = CURRENT_DATE WHERE feature_property_id = ${featurePropertyId}`
    );
    await connection.sql(
      SQL`UPDATE feature_type SET record_end_date = CURRENT_DATE WHERE feature_type_id = ${featureTypeId}`
    );
    expect(
      (await service.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperties(blueprintId, {}, pagination))
        .properties
    ).length(1);
    expect(
      (await service.blueprintFeatureTypeService.getBlueprintFeatureTypes(blueprintId, {}, pagination)).types
    ).length(1);
    try {
      await service.createBlueprintFeatureType(otherBlueprintId, { featureTypeId });
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiNotFoundError);
    }
  });
  for (const state of ['published', 'deleted']) {
    it(`excludes deleted assignments and prevents assignment deletion for a ${state} blueprint`, async () => {
      const deletedType = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
      await service.createBlueprintFeatureTypeProperty(blueprintId, {
        blueprintFeatureTypeId: deletedType.blueprint_feature_type_id,
        featurePropertyId
      });
      await service.deleteBlueprintFeatureType(blueprintId, deletedType.blueprint_feature_type_id);
      const type = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
      const deletedProperty = await service.createBlueprintFeatureTypeProperty(blueprintId, {
        blueprintFeatureTypeId: type.blueprint_feature_type_id,
        featurePropertyId
      });
      await service.deleteBlueprintFeatureTypeProperty(blueprintId, deletedProperty.blueprint_feature_type_property_id);
      const property = await service.createBlueprintFeatureTypeProperty(blueprintId, {
        blueprintFeatureTypeId: type.blueprint_feature_type_id,
        featurePropertyId
      });
      if (state === 'published') {
        await blueprints.publishBlueprint(blueprintId, {});
      } else {
        await blueprints.retireBlueprint(blueprintId);
      }
      const types = await service.blueprintFeatureTypeService.getBlueprintFeatureTypes(
        blueprintId,
        { active: false },
        { page: 1, limit: 10 }
      );
      const properties = await service.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperties(
        blueprintId,
        { active: false, blueprintFeatureTypeId: type.blueprint_feature_type_id },
        { page: 1, limit: 10 }
      );
      expect(types.types.map((row) => row.blueprint_feature_type_id)).to.deep.equal([type.blueprint_feature_type_id]);
      expect(types.pagination.total).to.equal(1);
      expect(properties.properties.map((row) => row.blueprint_feature_type_property_id)).to.deep.equal([
        property.blueprint_feature_type_property_id
      ]);
      expect(properties.pagination.total).to.equal(1);
      for (const remove of [
        () => service.deleteBlueprintFeatureType(blueprintId, type.blueprint_feature_type_id),
        () => service.deleteBlueprintFeatureTypeProperty(blueprintId, property.blueprint_feature_type_property_id)
      ]) {
        try {
          await remove();
          expect.fail('Expected immutable blueprint');
        } catch (error) {
          expect(error).to.be.instanceOf(ApiConflictError);
        }
      }
      const preserved = await service.blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperty(
        blueprintId,
        property.blueprint_feature_type_property_id
      );
      expect(preserved.record_end_date).to.be.null;
      expect(
        (await service.blueprintFeatureTypeService.getBlueprintFeatureType(blueprintId, type.blueprint_feature_type_id))
          .record_end_date
      ).to.be.null;
    });
  }

  it('treats today as effective and permits future creation', async () => {
    await blueprints.updateBlueprint(blueprintId, { recordEffectiveDate: '2999-01-01' });
    const a = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: a.blueprint_feature_type_id,
      featurePropertyId
    });
    const date = await blueprints.blueprintRepository.lockBlueprintAdministration();
    await blueprints.updateBlueprint(blueprintId, { recordEffectiveDate: date });
    try {
      await service.deleteBlueprintFeatureType(blueprintId, a.blueprint_feature_type_id);
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiConflictError);
    }
  });
  it('rolls back a cascading retirement as one transaction', async () => {
    const parent = await service.createBlueprintFeatureType(blueprintId, { featureTypeId });
    const child = await service.createBlueprintFeatureTypeProperty(blueprintId, {
      blueprintFeatureTypeId: parent.blueprint_feature_type_id,
      featurePropertyId
    });
    await connection.sql(SQL`SAVEPOINT before_retirement`);
    await service.deleteBlueprintFeatureType(blueprintId, parent.blueprint_feature_type_id);
    await connection.sql(SQL`ROLLBACK TO SAVEPOINT before_retirement`);
    const restored =
      await service.blueprintFeatureTypePropertyService.blueprintFeatureTypePropertyRepository.getBlueprintFeatureTypePropertyById(
        blueprintId,
        child.blueprint_feature_type_property_id
      );
    expect(restored.record_end_date).to.be.null;
    expect(
      (
        await service.blueprintFeatureTypeService.blueprintFeatureTypeRepository.getBlueprintFeatureTypeById(
          blueprintId,
          parent.blueprint_feature_type_id
        )
      ).record_end_date
    ).to.be.null;
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
