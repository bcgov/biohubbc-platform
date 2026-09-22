// Integration tests for Blueprint-owned property assignments (SIMSBIOHUB-1142).
//
// Drives BlueprintService against a real database and asserts on the rows it writes to blueprint,
// blueprint_feature_type and blueprint_feature_type_property, plus the constraints and trigger the
// migration adds to keep the transitional `feature_type_property_id` reference in agreement with the
// owned `feature_property_id`.
//
// Each test seeds its own fixture inside a transaction and rolls back after, so nothing is persisted.
// A new draft version is always created from the seeded default blueprint, so the composition being
// edited belongs to the test and no published blueprint is ever changed.
//
// Run: docker compose exec api npm run test:mocha -- --no-config --extension ts \
//        'src/__integration__/db/blueprint-service.integration.ts'
// Requires: database container running with seed data.

import { expect } from 'chai';
import { randomUUID } from 'crypto';
import { describe } from 'mocha';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError, ApiExecuteSQLError } from '../../errors/api-error';
import { AdminBlueprint, AdminBlueprintFeatureType } from '../../models/blueprint';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import { BlueprintService } from '../../services/blueprint-service';
import { createTestUpload, featureTypeIdByName } from '../helpers/test-feature-property-helpers';
import { createTestSubmission, getActiveDefaultBlueprintId } from '../helpers/test-submission-helpers';

const FEATURE_TYPE_NAME = 'capture';

/**
 * Extract the Postgres error message from a failed statement.
 *
 * The connection wraps every database error as `ApiExecuteSQLError('Failed to execute SQL')` and keeps
 * the original error in `errors[0]`.
 */
function databaseErrorMessage(error: unknown): string {
  const wrapped = (error as ApiExecuteSQLError).errors?.[0] as { message?: string } | string | undefined;
  if (wrapped && typeof wrapped === 'object' && typeof wrapped.message === 'string') {
    return wrapped.message;
  }
  return String(wrapped ?? (error as Error).message);
}

describe('BlueprintService — blueprint-owned property assignments (integration)', function () {
  this.timeout(20000);

  let connection: IDBConnection;
  let service: BlueprintService;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new BlueprintService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // --- local fixture helpers -----------------------------------------------

  /**
   * Insert a synthetic number-typed feature_property that has never been paired with any feature type.
   *
   * @return {Promise<number>} The new feature_property_id.
   */
  async function createUnpairedNumberProperty(): Promise<number> {
    const name = `test_bp_${randomUUID().replaceAll('-', '')}`;
    const result = await connection.sql(SQL`
      INSERT INTO feature_property (feature_property_type_id, name, display_name, record_effective_date, create_user)
      SELECT fpt.feature_property_type_id, ${name}, ${name}, now(), ${connection.systemUserId()}
      FROM feature_property_type fpt
      WHERE fpt.name = 'number'
      RETURNING feature_property_id;
    `);
    return result.rows[0].feature_property_id;
  }

  /**
   * Create a draft version of the seeded default blueprint and return it with its copy of the
   * fixture feature type.
   */
  async function createDraftWithFeatureType(): Promise<{
    draft: AdminBlueprint;
    blueprintFeatureType: AdminBlueprintFeatureType;
  }> {
    const defaultBlueprintId = await getActiveDefaultBlueprintId(connection);
    const draft = await service.createBlueprintVersion(defaultBlueprintId, {});
    const featureTypes = await service.getAdminBlueprintFeatureTypes(draft.blueprint_id);
    const blueprintFeatureType = featureTypes.find((ft) => ft.feature_type_name === FEATURE_TYPE_NAME);

    expect(blueprintFeatureType, `default blueprint includes ${FEATURE_TYPE_NAME}`).to.not.be.undefined;

    return { draft, blueprintFeatureType: blueprintFeatureType as AdminBlueprintFeatureType };
  }

  /** Read the active global pairing for a feature type and property, if any. */
  async function getActivePairing(
    featureTypeId: number,
    featurePropertyId: number
  ): Promise<{ feature_type_property_id: number; required_value: boolean; allow_multiple: boolean } | null> {
    const result = await connection.sql(SQL`
      SELECT feature_type_property_id, required_value, allow_multiple
      FROM feature_type_property
      WHERE feature_type_id = ${featureTypeId}
        AND feature_property_id = ${featurePropertyId}
        AND record_end_date IS NULL;
    `);
    return result.rows[0] ?? null;
  }

  /** Read the active assignments of a blueprint as a comparable set. */
  async function getActiveAssignments(blueprintId: number): Promise<
    {
      blueprint_feature_type_property_id: number;
      feature_type_id: number;
      feature_property_id: number;
      feature_type_property_id: number;
      required_value: boolean;
      allow_multiple: boolean;
      sort: number | null;
    }[]
  > {
    const result = await connection.sql(SQL`
      SELECT
        bftp.blueprint_feature_type_property_id,
        bft.feature_type_id,
        bftp.feature_property_id,
        bftp.feature_type_property_id,
        bftp.required_value,
        bftp.allow_multiple,
        bftp.sort
      FROM blueprint_feature_type_property bftp
      JOIN blueprint_feature_type bft ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
      WHERE bft.blueprint_id = ${blueprintId}
        AND bft.record_end_date IS NULL
        AND bftp.record_end_date IS NULL
      ORDER BY bft.feature_type_id, bftp.feature_property_id;
    `);
    return result.rows;
  }

  // --- versioning ------------------------------------------------------------

  describe('createBlueprintVersion', () => {
    it('copies every active assignment into new rows with distinct identifiers', async () => {
      const defaultBlueprintId = await getActiveDefaultBlueprintId(connection);

      const draft = await service.createBlueprintVersion(defaultBlueprintId, { name: 'Copy' });

      expect(draft.parent_blueprint_id).to.equal(defaultBlueprintId);
      expect(draft.record_effective_date).to.be.null;
      expect(draft.is_default).to.equal(false);
      expect(draft.name).to.equal('Copy');

      const source = await getActiveAssignments(defaultBlueprintId);
      const copy = await getActiveAssignments(draft.blueprint_id);

      expect(source.length).to.be.greaterThan(0);
      expect(copy.length).to.equal(source.length);

      const strip = (rows: typeof source) => rows.map(({ blueprint_feature_type_property_id: _id, ...rest }) => rest);
      expect(strip(copy)).to.deep.equal(strip(source));

      const sourceIds = new Set(source.map((row) => row.blueprint_feature_type_property_id));
      for (const row of copy) {
        expect(sourceIds.has(row.blueprint_feature_type_property_id)).to.equal(false);
      }
    });

    it('issues a version number higher than every version ever created', async () => {
      const defaultBlueprintId = await getActiveDefaultBlueprintId(connection);
      const maxBefore = await connection.sql<{ max: number }>(
        SQL`SELECT MAX(version_number)::int AS max FROM blueprint;`
      );

      const draft = await service.createBlueprintVersion(defaultBlueprintId, {});

      expect(draft.version_number).to.equal(maxBefore.rows[0].max + 1);
    });
  });

  // --- assignment ------------------------------------------------------------

  describe('createBlueprintFeatureTypeProperty', () => {
    it('assigns a property the feature type has never been paired with, creating a neutral pairing', async () => {
      const { draft, blueprintFeatureType } = await createDraftWithFeatureType();
      const featurePropertyId = await createUnpairedNumberProperty();

      expect(await getActivePairing(blueprintFeatureType.feature_type_id, featurePropertyId)).to.be.null;

      const assignment = await service.createBlueprintFeatureTypeProperty(
        draft.blueprint_id,
        blueprintFeatureType.blueprint_feature_type_id,
        { feature_property_id: featurePropertyId, required_value: true, allow_multiple: true, sort: 42 }
      );

      expect(assignment.feature_property_id).to.equal(featurePropertyId);
      expect(assignment.required_value).to.equal(true);
      expect(assignment.allow_multiple).to.equal(true);
      expect(assignment.sort).to.equal(42);
      expect(assignment.property_type_name).to.equal('number');

      // The compatibility pairing exists, points at the same property, and carries none of the
      // blueprint's configuration.
      const pairing = await getActivePairing(blueprintFeatureType.feature_type_id, featurePropertyId);
      expect(pairing).to.not.be.null;
      expect(pairing?.feature_type_property_id).to.equal(assignment.feature_type_property_id);
      expect(pairing?.required_value).to.equal(false);
      expect(pairing?.allow_multiple).to.equal(false);
    });

    it('reuses an existing pairing without changing it', async () => {
      const { draft, blueprintFeatureType } = await createDraftWithFeatureType();
      const featurePropertyId = await createUnpairedNumberProperty();

      const inserted = await connection.sql(SQL`
        INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value, record_effective_date, create_user)
        VALUES (${
          blueprintFeatureType.feature_type_id
        }, ${featurePropertyId}, true, now(), ${connection.systemUserId()})
        RETURNING feature_type_property_id;
      `);
      const pairingId = inserted.rows[0].feature_type_property_id;

      const assignment = await service.createBlueprintFeatureTypeProperty(
        draft.blueprint_id,
        blueprintFeatureType.blueprint_feature_type_id,
        { feature_property_id: featurePropertyId, required_value: false }
      );

      expect(assignment.feature_type_property_id).to.equal(pairingId);
      expect(assignment.required_value).to.equal(false);

      const pairing = await getActivePairing(blueprintFeatureType.feature_type_id, featurePropertyId);
      expect(pairing?.feature_type_property_id).to.equal(pairingId);
      expect(pairing?.required_value).to.equal(true);
    });

    it('rejects a duplicate active assignment and allows re-assignment after retirement', async () => {
      const { draft, blueprintFeatureType } = await createDraftWithFeatureType();
      const featurePropertyId = await createUnpairedNumberProperty();

      const first = await service.createBlueprintFeatureTypeProperty(
        draft.blueprint_id,
        blueprintFeatureType.blueprint_feature_type_id,
        { feature_property_id: featurePropertyId }
      );

      try {
        await service.createBlueprintFeatureTypeProperty(
          draft.blueprint_id,
          blueprintFeatureType.blueprint_feature_type_id,
          { feature_property_id: featurePropertyId }
        );
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      await service.deleteBlueprintFeatureTypeProperty(
        draft.blueprint_id,
        blueprintFeatureType.blueprint_feature_type_id,
        first.blueprint_feature_type_property_id
      );

      const second = await service.createBlueprintFeatureTypeProperty(
        draft.blueprint_id,
        blueprintFeatureType.blueprint_feature_type_id,
        { feature_property_id: featurePropertyId }
      );

      expect(second.blueprint_feature_type_property_id).to.not.equal(first.blueprint_feature_type_property_id);
    });

    it('rejects changes to a published blueprint', async () => {
      const defaultBlueprintId = await getActiveDefaultBlueprintId(connection);
      const featureTypes = await service.getAdminBlueprintFeatureTypes(defaultBlueprintId);
      const featurePropertyId = await createUnpairedNumberProperty();

      try {
        await service.createBlueprintFeatureTypeProperty(
          defaultBlueprintId,
          featureTypes[0].blueprint_feature_type_id,
          { feature_property_id: featurePropertyId }
        );
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect((error as ApiConflictError).message).to.include('published');
      }
    });
  });

  // --- independence ----------------------------------------------------------

  it('configures the same feature type and property independently per blueprint', async () => {
    // Blueprint A: required. Blueprint B: not assigned. Blueprint C: optional.
    const featurePropertyId = await createUnpairedNumberProperty();
    const a = await createDraftWithFeatureType();
    const b = await createDraftWithFeatureType();
    const c = await createDraftWithFeatureType();

    await service.createBlueprintFeatureTypeProperty(
      a.draft.blueprint_id,
      a.blueprintFeatureType.blueprint_feature_type_id,
      {
        feature_property_id: featurePropertyId,
        required_value: true
      }
    );
    await service.createBlueprintFeatureTypeProperty(
      c.draft.blueprint_id,
      c.blueprintFeatureType.blueprint_feature_type_id,
      {
        feature_property_id: featurePropertyId,
        required_value: false
      }
    );

    const find = (rows: Awaited<ReturnType<typeof getActiveAssignments>>) =>
      rows.find((row) => row.feature_property_id === featurePropertyId);

    const inA = find(await getActiveAssignments(a.draft.blueprint_id));
    const inB = find(await getActiveAssignments(b.draft.blueprint_id));
    const inC = find(await getActiveAssignments(c.draft.blueprint_id));

    expect(inA?.required_value).to.equal(true);
    expect(inB).to.be.undefined;
    expect(inC?.required_value).to.equal(false);

    // One shared pairing, untouched by either configuration.
    const pairing = await getActivePairing(a.blueprintFeatureType.feature_type_id, featurePropertyId);
    expect(pairing?.required_value).to.equal(false);
    expect(inA?.feature_type_property_id).to.equal(pairing?.feature_type_property_id);
    expect(inC?.feature_type_property_id).to.equal(pairing?.feature_type_property_id);
  });

  // --- feature types -----------------------------------------------------------

  it('retires the assignments of a feature type removed from a draft', async () => {
    const { draft, blueprintFeatureType } = await createDraftWithFeatureType();
    const before = await service.getAdminBlueprintFeatureTypeProperties(
      draft.blueprint_id,
      blueprintFeatureType.blueprint_feature_type_id
    );
    expect(before.length).to.be.greaterThan(0);

    await service.deleteBlueprintFeatureType(draft.blueprint_id, blueprintFeatureType.blueprint_feature_type_id);

    const remaining = await connection.sql<{ count: number }>(SQL`
      SELECT COUNT(*)::int AS count
      FROM blueprint_feature_type_property
      WHERE blueprint_feature_type_id = ${blueprintFeatureType.blueprint_feature_type_id}
        AND record_end_date IS NULL;
    `);
    expect(remaining.rows[0].count).to.equal(0);

    const featureTypes = await service.getAdminBlueprintFeatureTypes(draft.blueprint_id);
    expect(featureTypes.map((ft) => ft.feature_type_name)).to.not.include(FEATURE_TYPE_NAME);
  });

  // --- publishing --------------------------------------------------------------

  it('publishes a draft as the new default, clearing the previous one', async () => {
    const previousDefaultId = await getActiveDefaultBlueprintId(connection);
    const { draft } = await createDraftWithFeatureType();

    const published = await service.publishBlueprint(draft.blueprint_id, { is_default: true });

    expect(published.record_effective_date).to.not.be.null;
    expect(published.is_default).to.equal(true);

    const previous = await service.getAdminBlueprint(previousDefaultId);
    expect(previous.is_default).to.equal(false);
    expect(previous.record_end_date).to.be.null;

    expect(await getActiveDefaultBlueprintId(connection)).to.equal(draft.blueprint_id);
  });

  // --- database guards -------------------------------------------------------

  describe('database guards', () => {
    it('derives feature_property_id from the pairing when an insert omits it', async () => {
      const { blueprintFeatureType } = await createDraftWithFeatureType();
      const featurePropertyId = await createUnpairedNumberProperty();
      const inserted = await connection.sql(SQL`
        INSERT INTO feature_type_property (feature_type_id, feature_property_id, record_effective_date, create_user)
        VALUES (${blueprintFeatureType.feature_type_id}, ${featurePropertyId}, now(), ${connection.systemUserId()})
        RETURNING feature_type_property_id;
      `);

      const result = await connection.sql(SQL`
        INSERT INTO blueprint_feature_type_property (blueprint_feature_type_id, feature_type_property_id, create_user)
        VALUES (${blueprintFeatureType.blueprint_feature_type_id}, ${
        inserted.rows[0].feature_type_property_id
      }, ${connection.systemUserId()})
        RETURNING feature_property_id;
      `);

      expect(result.rows[0].feature_property_id).to.equal(featurePropertyId);
    });

    it('rejects an assignment whose pairing names a different property', async () => {
      const { blueprintFeatureType } = await createDraftWithFeatureType();
      const propertyA = await createUnpairedNumberProperty();
      const propertyB = await createUnpairedNumberProperty();
      const inserted = await connection.sql(SQL`
        INSERT INTO feature_type_property (feature_type_id, feature_property_id, record_effective_date, create_user)
        VALUES (${blueprintFeatureType.feature_type_id}, ${propertyA}, now(), ${connection.systemUserId()})
        RETURNING feature_type_property_id;
      `);

      try {
        await connection.sql(SQL`
          INSERT INTO blueprint_feature_type_property (blueprint_feature_type_id, feature_property_id, feature_type_property_id, create_user)
          VALUES (${blueprintFeatureType.blueprint_feature_type_id}, ${propertyB}, ${
          inserted.rows[0].feature_type_property_id
        }, ${connection.systemUserId()});
        `);
        expect.fail();
      } catch (error) {
        expect(databaseErrorMessage(error)).to.include('blueprint_feature_type_property_ftp_pairing_fk');
      }
    });

    it('rejects an assignment whose pairing belongs to a different feature type', async () => {
      const { blueprintFeatureType } = await createDraftWithFeatureType();
      const otherFeatureTypeId = await featureTypeIdByName(connection, 'dataset');
      const featurePropertyId = await createUnpairedNumberProperty();
      const inserted = await connection.sql(SQL`
        INSERT INTO feature_type_property (feature_type_id, feature_property_id, record_effective_date, create_user)
        VALUES (${otherFeatureTypeId}, ${featurePropertyId}, now(), ${connection.systemUserId()})
        RETURNING feature_type_property_id;
      `);

      try {
        await connection.sql(SQL`
          INSERT INTO blueprint_feature_type_property (blueprint_feature_type_id, feature_property_id, feature_type_property_id, create_user)
          VALUES (${blueprintFeatureType.blueprint_feature_type_id}, ${featurePropertyId}, ${
          inserted.rows[0].feature_type_property_id
        }, ${connection.systemUserId()});
        `);
        expect.fail();
      } catch (error) {
        expect(databaseErrorMessage(error)).to.include('does not belong to the feature type');
      }
    });
  });

  // --- ingestion -----------------------------------------------------------------

  it('resolves an ingested property through an assignment created purely via the service', async () => {
    const { draft, blueprintFeatureType } = await createDraftWithFeatureType();
    const featurePropertyId = await createUnpairedNumberProperty();
    const propertyName = (
      await connection.sql<{ name: string }>(
        SQL`SELECT name FROM feature_property WHERE feature_property_id = ${featurePropertyId};`
      )
    ).rows[0].name;

    const assignment = await service.createBlueprintFeatureTypeProperty(
      draft.blueprint_id,
      blueprintFeatureType.blueprint_feature_type_id,
      { feature_property_id: featurePropertyId, required_value: true, allow_multiple: true }
    );

    // Stage one raw property for a feature of the fixture type in an upload pinned to the draft.
    const submissionId = await createTestSubmission(connection);
    const submissionUploadId = await createTestUpload(connection, submissionId);
    const feature = await connection.sql(SQL`
      INSERT INTO submission_feature (
        submission_id, submission_upload_id, feature_type_id, source_id, data, data_byte_size, record_effective_date, create_user
      )
      VALUES (
        ${submissionId}, ${submissionUploadId}, ${
      blueprintFeatureType.feature_type_id
    }, ${randomUUID()}, '{}'::jsonb, 502, now(), ${connection.systemUserId()}
      )
      RETURNING submission_feature_id;
    `);
    await connection.sql(SQL`
      INSERT INTO submission_upload_staging_raw_property (submission_feature_id, submission_upload_id, feature_type_id, property_name, value)
      VALUES (${feature.rows[0].submission_feature_id}, ${submissionUploadId}::uuid, ${blueprintFeatureType.feature_type_id}, ${propertyName}, '7'::jsonb);
    `);

    const ingestion = new SubmissionFeaturePropertyIngestionRepository(connection);
    await ingestion.populateResolvedPropertyStagingBySubmissionUploadId(submissionUploadId, draft.blueprint_id);

    const resolved = await connection.sql(SQL`
      SELECT feature_type_property_id, blueprint_feature_type_property_id, required_value, allow_multiple, property_type_name
      FROM submission_upload_staging_resolved_property
      WHERE submission_upload_id = ${submissionUploadId}::uuid
        AND property_name = ${propertyName};
    `);

    expect(resolved.rowCount).to.equal(1);
    expect(resolved.rows[0].blueprint_feature_type_property_id).to.equal(assignment.blueprint_feature_type_property_id);
    expect(resolved.rows[0].feature_type_property_id).to.equal(assignment.feature_type_property_id);
    expect(resolved.rows[0].required_value).to.equal(true);
    expect(resolved.rows[0].allow_multiple).to.equal(true);
    expect(resolved.rows[0].property_type_name).to.equal('number');
  });
});
