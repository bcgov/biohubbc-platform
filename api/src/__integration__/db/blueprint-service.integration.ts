// Integration tests for Blueprint-owned property assignments.
//
// Drives BlueprintService against a real database and asserts on the rows it writes to blueprint,
// blueprint_feature_type, blueprint_feature_type_property and feature_type_property_feature, plus the
// database guards that keep every stored value, and every allowed reference target, on an assignment
// that belongs to the right feature type, Blueprint and storage table.
//
// Each test seeds its own fixture inside a transaction and rolls back after, so nothing is persisted.
// A new draft version is always created from the seeded default blueprint, so the composition being
// edited belongs to the test and no published blueprint is ever changed.
//
// Run: docker compose exec api npm run test:mocha -- --no-config --extension ts \
//        'src/__integration__/db/blueprint-service.integration.ts'
// Requires: database container running with seed data.

import { expect } from 'chai';
import { describe } from 'mocha';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError, ApiExecuteSQLError } from '../../errors/api-error';
import { AdminBlueprint, AdminBlueprintFeatureType } from '../../models/blueprint';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import { BlueprintService } from '../../services/blueprint-service';
import {
  createBlueprintFeatureTypeProperty,
  createTestUpload,
  featureTypeIdByName
} from '../helpers/test-feature-property-helpers';
import {
  createTestFeature,
  createTestSubmission,
  getActiveDefaultBlueprintId
} from '../helpers/test-submission-helpers';

const FEATURE_TYPE_NAME = 'capture';

/** A feature type the default Blueprint assigns number and string properties to, for the storage guards. */
const GUARD_FEATURE_TYPE_NAME = 'species_observation';

/** A second feature type with a number assignment, for the cross-type guard. */
const OTHER_GUARD_FEATURE_TYPE_NAME = 'measurement';

/**
 * Extract the Postgres error message from a failed statement.
 *
 * The connection wraps every database error as `ApiExecuteSQLError('Failed to execute SQL')` and keeps
 * the original error in `errors[0]`. `BaseError` flattens that entry, so it arrives as a plain object
 * carrying `message` rather than as an `Error` instance.
 *
 * @param {unknown} error - The error thrown by the connection.
 * @return {string} The underlying database message, or the wrapper's own message when none is carried.
 */
function databaseErrorMessage(error: unknown): string {
  const wrapped = (error as ApiExecuteSQLError).errors?.[0];

  if (typeof wrapped === 'string') {
    return wrapped;
  }

  const message = (wrapped as { message?: unknown } | undefined)?.message;

  return typeof message === 'string' ? message : (error as Error).message;
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

  /** Read the active assignments of a blueprint as a comparable set. */
  async function getActiveAssignments(blueprintId: number): Promise<
    {
      blueprint_feature_type_property_id: number;
      feature_type_id: number;
      feature_property_id: number;
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
    it('assigns a property with the requested configuration', async () => {
      const { draft, blueprintFeatureType } = await createDraftWithFeatureType();
      const featurePropertyId = await createUnpairedNumberProperty();

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
    /**
     * Resolve, for a feature uploaded under the default Blueprint, an active assignment of its type with
     * the given declared property type.
     */
    async function findAssignmentOfFeature(
      submissionFeatureId: number,
      declaredTypeName: string
    ): Promise<{ blueprint_feature_type_property_id: number; feature_property_id: number }> {
      const result = await connection.sql(SQL`
        SELECT bftp.blueprint_feature_type_property_id, bftp.feature_property_id
        FROM submission_feature sf
        JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
        JOIN blueprint_feature_type bft
          ON bft.blueprint_id = su.blueprint_id AND bft.feature_type_id = sf.feature_type_id AND bft.record_end_date IS NULL
        JOIN blueprint_feature_type_property bftp
          ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id AND bftp.record_end_date IS NULL
        JOIN feature_property fp ON fp.feature_property_id = bftp.feature_property_id
        JOIN feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
        WHERE sf.submission_feature_id = ${submissionFeatureId}
          AND fpt.name = ${declaredTypeName}
        ORDER BY bftp.blueprint_feature_type_property_id
        LIMIT 1;
      `);
      expect(result.rows[0], `feature has a ${declaredTypeName} assignment`).to.not.be.undefined;
      return result.rows[0];
    }

    /** Store a number value for a feature under an assignment, returning the database error if any. */
    async function tryInsertNumber(submissionFeatureId: number, assignmentId: number | null): Promise<unknown> {
      try {
        await connection.sql(SQL`
          INSERT INTO submission_feature_property_number (submission_feature_id, blueprint_feature_type_property_id, value, create_user)
          VALUES (${submissionFeatureId}, ${assignmentId}, 1, ${connection.systemUserId()});
        `);
        return null;
      } catch (error) {
        return error;
      }
    }

    it('requires every stored value to carry an assignment', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, GUARD_FEATURE_TYPE_NAME, {});

      const error = await tryInsertNumber(featureId, null);

      expect(databaseErrorMessage(error)).to.include('blueprint_feature_type_property_id');
    });

    it('rejects a value whose assignment is declared for another storage table', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, GUARD_FEATURE_TYPE_NAME, {});
      const stringAssignment = await findAssignmentOfFeature(featureId, 'string');

      const error = await tryInsertNumber(featureId, stringAssignment.blueprint_feature_type_property_id);

      expect(databaseErrorMessage(error)).to.include('is declared as string');
    });

    it('rejects a value whose assignment belongs to another feature type', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, GUARD_FEATURE_TYPE_NAME, {});
      const otherFeatureId = await createTestFeature(connection, submissionId, OTHER_GUARD_FEATURE_TYPE_NAME, {});
      const otherAssignment = await findAssignmentOfFeature(otherFeatureId, 'number');

      const error = await tryInsertNumber(featureId, otherAssignment.blueprint_feature_type_property_id);

      expect(databaseErrorMessage(error)).to.include('does not belong to the feature type');
    });

    it('rejects a value whose assignment belongs to another Blueprint', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, GUARD_FEATURE_TYPE_NAME, {});
      const defaultBlueprintId = await getActiveDefaultBlueprintId(connection);
      const draft = await service.createBlueprintVersion(defaultBlueprintId, {});
      const draftFeatureType = (await service.getAdminBlueprintFeatureTypes(draft.blueprint_id)).find(
        (featureType) => featureType.feature_type_name === GUARD_FEATURE_TYPE_NAME
      );
      expect(draftFeatureType, 'draft includes the guard feature type').to.not.be.undefined;
      const draftAssignments = await service.getAdminBlueprintFeatureTypeProperties(
        draft.blueprint_id,
        (draftFeatureType as AdminBlueprintFeatureType).blueprint_feature_type_id
      );
      const draftNumber = draftAssignments.find((assignment) => assignment.property_type_name === 'number');
      expect(draftNumber, 'draft copies a number assignment').to.not.be.undefined;

      const error = await tryInsertNumber(
        featureId,
        (draftNumber as { blueprint_feature_type_property_id: number }).blueprint_feature_type_property_id
      );

      expect(databaseErrorMessage(error)).to.include('was uploaded under blueprint');
    });

    it('accepts a value under an assignment that has since been retired', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, GUARD_FEATURE_TYPE_NAME, {});
      const numberAssignment = await findAssignmentOfFeature(featureId, 'number');
      await connection.sql(SQL`
        UPDATE blueprint_feature_type_property
        SET record_end_date = now()
        WHERE blueprint_feature_type_property_id = ${numberAssignment.blueprint_feature_type_property_id};
      `);

      const error = await tryInsertNumber(featureId, numberAssignment.blueprint_feature_type_property_id);

      expect(error).to.be.null;
    });

    it('rejects allowed reference targets declared for a non-feature assignment', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, GUARD_FEATURE_TYPE_NAME, {});
      const numberAssignment = await findAssignmentOfFeature(featureId, 'number');
      const targetFeatureTypeId = await featureTypeIdByName(connection, 'dataset');

      try {
        await connection.sql(SQL`
          INSERT INTO feature_type_property_feature (blueprint_feature_type_property_id, target_feature_type_id, create_user)
          VALUES (${
            numberAssignment.blueprint_feature_type_property_id
          }, ${targetFeatureTypeId}, ${connection.systemUserId()});
        `);
        expect.fail();
      } catch (error) {
        expect(databaseErrorMessage(error)).to.include('cannot declare target feature types');
      }
    });

    it('copies allowed reference targets onto the assignments of a new version', async () => {
      const { blueprintFeatureTypePropertyId, featurePropertyId, allowedFeatureTypeIds } =
        await createBlueprintFeatureTypeProperty(connection, GUARD_FEATURE_TYPE_NAME, ['dataset', 'survey']);
      expect(allowedFeatureTypeIds).to.have.lengthOf(2);

      const defaultBlueprintId = await getActiveDefaultBlueprintId(connection);
      const draft = await service.createBlueprintVersion(defaultBlueprintId, {});

      const copied = await connection.sql<{
        blueprint_feature_type_property_id: number;
        target_feature_type_id: number;
      }>(SQL`
        SELECT ftpf.blueprint_feature_type_property_id, ftpf.target_feature_type_id
        FROM feature_type_property_feature ftpf
        JOIN blueprint_feature_type_property bftp
          ON bftp.blueprint_feature_type_property_id = ftpf.blueprint_feature_type_property_id
        JOIN blueprint_feature_type bft ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
        WHERE bft.blueprint_id = ${draft.blueprint_id}
          AND bftp.feature_property_id = ${featurePropertyId}
          AND ftpf.record_end_date IS NULL
        ORDER BY ftpf.target_feature_type_id;
      `);

      expect(copied.rows.map((row) => row.target_feature_type_id)).to.eql(
        [...allowedFeatureTypeIds].sort((a, b) => a - b)
      );
      for (const row of copied.rows) {
        expect(row.blueprint_feature_type_property_id).to.not.equal(blueprintFeatureTypePropertyId);
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
      SELECT blueprint_feature_type_property_id, required_value, allow_multiple, property_type_name
      FROM submission_upload_staging_resolved_property
      WHERE submission_upload_id = ${submissionUploadId}::uuid
        AND property_name = ${propertyName};
    `);

    expect(resolved.rowCount).to.equal(1);
    expect(resolved.rows[0].blueprint_feature_type_property_id).to.equal(assignment.blueprint_feature_type_property_id);
    expect(resolved.rows[0].required_value).to.equal(true);
    expect(resolved.rows[0].allow_multiple).to.equal(true);
    expect(resolved.rows[0].property_type_name).to.equal('number');
  });
});
