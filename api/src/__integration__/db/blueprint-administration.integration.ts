import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError, ApiNotFoundError } from '../../errors/api-error';
import { ensureHTTPError } from '../../errors/http-error';
import { Blueprint } from '../../models/blueprint';
import { BlueprintService } from '../../services/blueprint-service';
import { FeaturePropertyService } from '../../services/feature-property-service';
import { FeatureTypeService } from '../../services/feature-type-service';
import { createTestSubmission, createTestUploadWithFeatures } from '../helpers/test-submission-helpers';

describe('blueprint administration (integration)', function () {
  this.timeout(20000);
  let connection: IDBConnection;
  let service: BlueprintService;
  let first: Blueprint;
  let second: Blueprint;
  const keyword = `configuration_${randomUUID()}`;

  before(async () => {
    initDBPool(defaultPoolConfig);
    const setup = getAPIUserDBConnection();
    await setup.open();
    try {
      const setupService = new BlueprintService(setup);
      first = await setupService.createBlueprint({
        name: `${keyword}_a`,
        recordEffectiveDate: '2000-01-01'
      });
      second = await setupService.createBlueprint({
        name: `${keyword}_b`
      });
      await setup.commit();
    } catch (error) {
      await setup.rollback();
      throw error;
    } finally {
      setup.release();
    }
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new BlueprintService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  after(async () => {
    if (!first || !second) {
      return;
    }
    const cleanup = getAPIUserDBConnection();
    await cleanup.open();
    try {
      const cleanupService = new BlueprintService(cleanup);
      await cleanupService.blueprintRepository.lockBlueprintAdministration();
      await cleanup.sql(SQL`UPDATE blueprint SET parent_blueprint_id = NULL WHERE name LIKE ${keyword + '%'};`);
      await cleanup.sql(SQL`DELETE FROM blueprint WHERE name LIKE ${keyword + '%'};`);
      await cleanup.commit();
    } catch (error) {
      await cleanup.rollback();
      throw error;
    } finally {
      cleanup.release();
    }
  });

  it('lists all lifecycle states with matching filtered counts and stable pagination', async () => {
    const retired = await service.retireBlueprint(second.blueprint_id);
    expect(retired.record_effective_date).to.be.null;
    expect(retired.record_end_date).to.be.a('string');
    const page = await service.getBlueprints(
      { keyword: keyword.toUpperCase() },
      { page: 1, limit: 1, sort: 'name', order: 'asc' }
    );
    expect(page.pagination.total).to.equal(2);
    expect(page.blueprints[0].blueprint_id).to.equal(first.blueprint_id);
    const next = await service.getBlueprints({ keyword }, { page: 2, limit: 1, sort: 'name', order: 'asc' });
    expect(next.blueprints[0]).to.deep.equal(retired);
    expect(await service.retireBlueprint(second.blueprint_id)).to.deep.equal(retired);
  });

  it('matches keyword against blueprint names rather than descriptions', async () => {
    await service.createBlueprint({
      name: randomUUID(),
      description: keyword
    });
    const result = await service.getBlueprints(
      { keyword: keyword.toUpperCase() },
      { page: 1, limit: 25, sort: 'name' }
    );
    expect(result.pagination.total).to.equal(2);
    expect(result.blueprints.map((blueprint) => blueprint.blueprint_id)).to.deep.equal([
      first.blueprint_id,
      second.blueprint_id
    ]);
  });

  it('returns an empty filtered page without broadening the query', async () => {
    const result = await service.getBlueprints({ keyword: randomUUID() }, { page: 1, limit: 10, sort: 'name' });
    expect(result.blueprints).to.deep.equal([]);
    expect(result.pagination.total).to.equal(0);
  });

  it('preserves upload and assignment references when retiring a blueprint', async () => {
    const submissionId = await createTestSubmission(connection);
    const submissionUploadId = await createTestUploadWithFeatures(connection, submissionId, 'observation', []);
    await connection.sql(SQL`UPDATE submission_upload SET blueprint_id = ${first.blueprint_id}
      WHERE submission_upload_id = ${submissionUploadId};`);
    const assignment = await connection.sql(SQL`INSERT INTO blueprint_feature_type (blueprint_id, feature_type_id)
      SELECT ${first.blueprint_id}, feature_type_id FROM feature_type WHERE record_end_date IS NULL LIMIT 1
      RETURNING blueprint_feature_type_id;`);
    await service.retireBlueprint(first.blueprint_id);
    const upload = await connection.sql(
      SQL`SELECT blueprint_id FROM submission_upload WHERE submission_upload_id = ${submissionUploadId};`
    );
    const retained = await connection.sql(SQL`SELECT blueprint_id FROM blueprint_feature_type
      WHERE blueprint_feature_type_id = ${assignment.rows[0].blueprint_feature_type_id};`);
    expect(upload.rows[0].blueprint_id).to.equal(first.blueprint_id);
    expect(retained.rows[0].blueprint_id).to.equal(first.blueprint_id);
  });

  it('returns lifecycle dates and database property-type identifiers through existing feature services', async () => {
    const featureTypeService = new FeatureTypeService(connection);
    const featurePropertyService = new FeaturePropertyService(connection);
    const types = await featurePropertyService.getFeaturePropertyTypes();
    const propertyType = types.feature_property_types.find((type) => type.name === 'string');
    expect(propertyType).not.to.be.undefined;
    const featureType = await featureTypeService.createFeatureType({
      name: keyword,
      display_name: 'Configuration test'
    });
    const property = await featurePropertyService.createFeatureProperty({
      name: keyword,
      display_name: 'Configuration test',
      feature_property_type_id: propertyType!.feature_property_type_id
    });
    expect(featureType.record_effective_date).to.be.a('string');
    expect(featureType.record_end_date).to.be.null;
    expect(property.record_effective_date).to.be.a('string');
    expect(property.record_end_date).to.be.null;
  });

  it('lists and edits retired global definitions while excluding them from assignment creation', async () => {
    const featureTypes = new FeatureTypeService(connection);
    const properties = new FeaturePropertyService(connection);
    const propertyTypes = await properties.getFeaturePropertyTypes();
    const definitionName = `retired_${randomUUID()}`;
    const featureType = await featureTypes.createFeatureType({ name: definitionName, display_name: 'Original type' });
    const property = await properties.createFeatureProperty({
      name: definitionName,
      display_name: 'Original property',
      feature_property_type_id: propertyTypes.feature_property_types.find((row) => row.name === 'string')!
        .feature_property_type_id
    });
    await featureTypes.deleteFeatureType(featureType.feature_type_id);
    await properties.deleteFeatureProperty(property.feature_property_id);
    const retiredType = await featureTypes.getAdminFeatureType(featureType.feature_type_id);
    const retiredProperty = await properties.getAdminFeatureProperty(property.feature_property_id);
    const updatedType = await featureTypes.updateFeatureType(featureType.feature_type_id, {
      display_name: 'Updated type',
      description: 'Updated description'
    });
    const updatedProperty = await properties.updateFeatureProperty(property.feature_property_id, {
      display_name: 'Updated property',
      description: null
    });
    expect(updatedType).include({
      name: definitionName,
      display_name: 'Updated type',
      description: 'Updated description',
      record_end_date: retiredType.record_end_date
    });
    expect(updatedProperty).include({
      name: definitionName,
      display_name: 'Updated property',
      description: null,
      type_name: 'string',
      record_end_date: retiredProperty.record_end_date
    });
    expect(updatedType.record_end_date).to.be.a('string');
    expect(updatedProperty.record_end_date).to.be.a('string');
    const filters = { search: definitionName };
    const pagination = { page: 1, limit: 1 };
    expect(await featureTypes.getFeatureTypes(filters, pagination)).deep.equal([updatedType]);
    expect(await featureTypes.getFeatureTypesCount(filters)).equal(1);
    expect(await properties.getFeatureProperties(filters, pagination)).deep.equal([updatedProperty]);
    expect(await properties.getFeaturePropertiesCount(filters)).equal(1);
    for (const read of [
      () => featureTypes.getFeatureType(featureType.feature_type_id),
      () => properties.getFeatureProperty(property.feature_property_id)
    ]) {
      try {
        await read();
        expect.fail('Retired definitions cannot be selected for new assignments');
      } catch (error) {
        expect(error).instanceOf(ApiNotFoundError);
      }
    }
  });

  it('allows descriptive metadata edits but freezes lifecycle once the effective date arrives', async () => {
    const draft = await service.createBlueprint({ name: keyword });
    await service.updateBlueprint(draft.blueprint_id, { recordEffectiveDate: '2999-01-01' });
    await service.updateBlueprint(draft.blueprint_id, { description: 'Still editable' });
    const currentDate = await service.blueprintRepository.lockBlueprintAdministration();
    await service.updateBlueprint(draft.blueprint_id, { recordEffectiveDate: currentDate });
    const updated = await service.updateBlueprint(draft.blueprint_id, { name: 'Changed', description: null });
    expect(updated.name).equal('Changed');
    expect(updated.description).to.be.null;
    expect(updated.record_effective_date).equal(currentDate);
    try {
      await service.updateBlueprint(draft.blueprint_id, { recordEffectiveDate: null });
      expect.fail('Expected effective blueprint conflict');
    } catch (error) {
      expect(error).instanceOf(ApiConflictError);
    }
  });

  it('assigns increasing versions including retired records and preserves versions on edits', async () => {
    expect(second.version_number).to.equal(first.version_number + 1);
    await service.retireBlueprint(second.blueprint_id);
    const created = await service.createBlueprint({ name: keyword });
    expect(created.version_number).to.equal(second.version_number + 1);
    const updated = await service.updateBlueprint(created.blueprint_id, { name: 'Renamed' });
    expect(updated.version_number).to.equal(created.version_number);
  });

  it('serializes concurrent creates so each committed blueprint receives the next version', async () => {
    const created = await service.createBlueprint({ name: keyword });
    const competing = getAPIUserDBConnection();
    await competing.open();
    try {
      const competingService = new BlueprintService(competing);
      const pending = competingService.createBlueprint({ name: keyword });
      await connection.commit();
      const next = await pending;
      expect(next.version_number).to.equal(created.version_number + 1);
    } finally {
      await competing.rollback();
      competing.release();
      await connection.sql(SQL`DELETE FROM blueprint WHERE blueprint_id = ${created.blueprint_id};`);
      await connection.commit();
    }
  });

  it('uses database uniqueness for versions even when names differ', async () => {
    try {
      await connection.sql(
        SQL`INSERT INTO blueprint (name, version_number) VALUES ('Different name', ${first.version_number});`
      );
      expect.fail('Expected duplicate version');
    } catch (error) {
      expect(ensureHTTPError(error).status).to.equal(500);
    }
  });

  it('allows repeated retired versions and preserves retired lineage references', async () => {
    await service.retireBlueprint(first.blueprint_id);
    await service.updateBlueprint(second.blueprint_id, { parentBlueprintId: first.blueprint_id });
    const replacement = await service.createBlueprint({
      name: keyword,
      parentBlueprintId: first.blueprint_id
    });
    await service.retireBlueprint(replacement.blueprint_id);
    await connection.sql(SQL`UPDATE blueprint SET version_number = ${first.version_number}
      WHERE blueprint_id = ${replacement.blueprint_id};`);
    const next = await service.createBlueprint({ name: keyword });
    expect(next.version_number).to.equal(second.version_number + 1);
    expect(next.record_effective_date).to.be.null;
    expect(next.is_default).to.equal(false);
    expect((await service.getBlueprint(second.blueprint_id)).parent_blueprint_id).to.equal(first.blueprint_id);
  });

  it('rejects cycles traversing retired ancestors', async () => {
    const first = await service.createBlueprint({ name: keyword });
    await service.updateBlueprint(first.blueprint_id, { parentBlueprintId: second.blueprint_id });
    await service.retireBlueprint(first.blueprint_id);
    try {
      await service.updateBlueprint(second.blueprint_id, { parentBlueprintId: first.blueprint_id });
      expect.fail('Expected cycle conflict');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiConflictError);
    }
  });

  it('rolls back default changes without changing the persisted default', async () => {
    const original = await service.blueprintRepository.findDefaultBlueprintId();
    await service.setDefaultBlueprint(first.blueprint_id);
    expect(await service.blueprintRepository.findDefaultBlueprintId()).to.equal(first.blueprint_id);
    await connection.rollback();
    expect(await service.blueprintRepository.findDefaultBlueprintId()).to.equal(original);
  });

  it('serializes concurrent default switches and preserves at most one current default', async () => {
    await service.setDefaultBlueprint(first.blueprint_id);
    const competing = getAPIUserDBConnection();
    await competing.open();
    const competingService = new BlueprintService(competing);
    try {
      const pending = competingService.setDefaultBlueprint(first.blueprint_id);
      await connection.rollback();
      expect((await pending).is_default).to.equal(true);
      const count = await competing.sql(
        SQL`SELECT count(*)::integer AS count FROM blueprint WHERE is_default AND record_end_date IS NULL;`
      );
      expect(count.rows[0].count).to.equal(1);
    } finally {
      await competing.rollback();
      competing.release();
    }
  });

  it('revalidates eligibility after a concurrent effective-date edit commits', async () => {
    await service.updateBlueprint(second.blueprint_id, { recordEffectiveDate: '2999-01-01' });
    const competing = getAPIUserDBConnection();
    await competing.open();
    const competingService = new BlueprintService(competing);
    try {
      const pending = competingService.setDefaultBlueprint(second.blueprint_id);
      await connection.commit();
      try {
        await pending;
        expect.fail('Expected future-date conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    } finally {
      await competing.rollback();
      competing.release();
    }
  });

  it('revalidates retirement after a concurrent default selection', async () => {
    await service.setDefaultBlueprint(first.blueprint_id);
    const competing = getAPIUserDBConnection();
    await competing.open();
    const competingService = new BlueprintService(competing);
    try {
      const pending = competingService.retireBlueprint(first.blueprint_id);
      // Rollback avoids persisting a change to the development database's default.
      await connection.rollback();
      const retired = await pending;
      expect(retired.is_default).to.equal(false);
      expect(retired.record_end_date).not.to.be.null;
    } finally {
      await competing.rollback();
      competing.release();
    }
  });

  it('serializes competing parent edits so only an acyclic lineage can commit', async () => {
    const first = await service.createBlueprint({ name: keyword });
    await service.updateBlueprint(first.blueprint_id, { parentBlueprintId: second.blueprint_id });
    const competing = getAPIUserDBConnection();
    await competing.open();
    const competingService = new BlueprintService(competing);
    try {
      const pending = competingService.updateBlueprint(second.blueprint_id, { parentBlueprintId: first.blueprint_id });
      await connection.commit();
      try {
        await pending;
        expect.fail('Expected cycle conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    } finally {
      await competing.rollback();
      competing.release();
    }
  });
});
