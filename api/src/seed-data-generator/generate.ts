// Run-once api-context tool that produces correct seed DB rows for a dataset tar by running the
// REAL ingestion pipeline (ingest -> index -> closure), then secures a subset of telemetry
// deployments and computes their security-scope anchors synchronously.
//
// The committed deliverable is the fixture dumped from the rows this produces, not the generator
// itself — running it requires DB + MinIO (not the queue). It is intentionally NOT wired into any
// build or request flow.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import SQL from 'sql-template-strings';
import * as tar from 'tar-stream';
import { IDBConnection } from '../database/db';
import { withConnection } from '../queue/with-connection';
import { SecurityScopeRepository } from '../repositories/authorization/security-scope-repository';
import { SubmissionFeaturePropertyIngestionService } from '../services/ingestion/submission-feature-property-ingestion-service';
import { SubmissionIngestionService } from '../services/ingestion/submission-ingestion-service';
import { BucketType, ObjectStorageService } from '../services/object-storage/object-storage-service';
import { SecurityService } from '../services/security-service';
import { SubmissionFeatureClosureService } from '../services/submission-feature-closure-service';
import { SubmissionFeatureService } from '../services/submission-feature-service';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('seed-data-generator/generate');

/**
 * Marker tagging every artifact and submission this generator creates as generator-owned.
 *
 * It is written to the submission's `comment`/`description` and the artifact object-key namespace —
 * deliberately NOT the submission `name`, which stays the clean human dataset title because that field
 * is user-visible in search results and on feature detail pages. Re-runs delete the prior submission
 * matching (clean name + this marker) before re-ingesting, so the marker is the natural key that makes
 * the generator idempotent without ever touching a real user submission that happens to share the name
 * (the prototype had no cleanup and stacked duplicate submissions on every run).
 */
const SEED_SNAPSHOT_PREFIX = '__seed-snapshot__';

/**
 * The security rule applied to the demo's secured telemetry deployments.
 *
 * Resolved by name, never by id: security-rule ids are assigned by migration order and are not
 * stable across environments, so resolving by id risks applying the wrong rule (id 1 is Gyrfalcon,
 * not Moose) if the migration order ever shifts.
 */
const DEMO_SECURITY_RULE_NAME = 'Moose';

/**
 * The security rule applied to the demo's secured study_area.
 *
 * Distinct from the telemetry rule so the two lock demos read as different reasons in the security UI,
 * and resolved by name for the same id-stability reason. A study_area is a sensitive spatial site, so a
 * location-secrecy rule fits. Securing it activates the otherwise-dormant Sampling Sites policy in the
 * seed config, giving a second, top-level lock demo alongside the telemetry partial-secure.
 */
const STUDY_AREA_SECURITY_RULE_NAME = 'Mineral Lick Locations';

/**
 * Default animal identifiers for the three deployments secured in the demo.
 *
 * Deliberately the three deployments whose telemetry are ingested FIRST (the lowest
 * submission_feature_id block). The search results table sorts by submission_feature_id ascending, so
 * securing the leading blocks makes the lock icons visible on page one instead of buried hundreds of
 * pages behind the unsecured deployments. Securing three of six keeps the partial-secure ("lock icon on
 * some, not all") demo; securing all six, or the dataset root, would lock everything and defeat it. The
 * Moose run passes these as `secureDeploymentIdentifiers`; the sampler run omits the option and is left
 * fully unsecured.
 */
export const DEFAULT_SECURE_DEPLOYMENT_IDENTIFIERS = ['15-5595', '15-5593', '15-5592'];

export interface GenerateSnapshotOptions {
  /** Path to an external dataset tar file, OR the committed sampler source directory. */
  tarPath: string;
  /** Human-readable submission name, e.g. 'Boreal Moose' or 'Feature Type Sampler'. */
  submissionName: string;
  /** animal_identifier values of the deployments to secure. Omit to skip securing (sampler). */
  secureDeploymentIdentifiers?: string[];
}

export interface GenerateSnapshotResult {
  submissionId: number;
  submissionUploadId: string;
}

/** A telemetry_deployment feature with the two properties used to identify it for securing. */
interface DeploymentRow {
  submission_feature_id: number;
  animal_identifier: string;
  device_key: string;
}

/** A row from the active-security-rule lookup. */
interface SecurityRuleIdRow {
  security_rule_id: number;
}

/** The submission FK chain seeded before ingestion. */
interface SeededFkChain {
  submissionId: number;
  uploadId: string;
  submissionUploadId: string;
  ticketId: string;
  teamId: string;
  blueprintId: number;
}

/**
 * Select the deployment feature ids to secure, matching by animal_identifier.
 *
 * Throws — rather than silently securing a short list — when the number of matched deployments does
 * not equal the number of requested identifiers, or when nothing matched. A run that secures the
 * wrong count produces a fixture whose locked/unlocked split is wrong, which is invisible until the
 * demo is inspected by hand; failing loudly here turns a silent data error into an immediate stop.
 *
 * @param {DeploymentRow[]} deployments All telemetry_deployment features in the submission.
 * @param {string[]} identifiers The animal_identifier values whose deployments should be secured.
 * @returns {number[]} The submission_feature_id of each matched deployment.
 */
function selectDeploymentsToSecure(deployments: DeploymentRow[], identifiers: string[]): number[] {
  const wanted = new Set(identifiers);
  const matched = deployments.filter((deployment) => wanted.has(deployment.animal_identifier));

  if (matched.length === 0) {
    throw new Error(
      `selectDeploymentsToSecure: no telemetry_deployment matched identifiers [${identifiers.join(', ')}]`
    );
  }

  if (matched.length !== identifiers.length) {
    throw new Error(
      `selectDeploymentsToSecure: expected ${identifiers.length} deployment matches, found ${matched.length} ` +
        `for identifiers [${identifiers.join(', ')}]`
    );
  }

  return matched.map((deployment) => deployment.submission_feature_id);
}

/**
 * Assert that exactly one active security rule of the given name exists and return its id.
 *
 * Throws when the rule is absent so a renamed or missing rule fails the run immediately rather than
 * leaving the demo dataset unsecured. Extracted as a pure predicate so the fail-loud behaviour is
 * unit-testable without a database.
 *
 * @param {SecurityRuleIdRow[]} rows The active rules returned for the looked-up name.
 * @param {string} ruleName The rule name used in the error message.
 * @returns {number} The single matching security_rule_id.
 */
function assertRuleRow(rows: SecurityRuleIdRow[], ruleName: string): number {
  if (rows.length !== 1) {
    throw new Error(`assertRuleRow: expected exactly one active '${ruleName}' security rule, found ${rows.length}`);
  }

  return rows[0].security_rule_id;
}

/**
 * Run the full generator: stage tar -> seed FK chain -> ingest -> index -> closure -> secure -> anchors.
 *
 * Each database step runs in its own short transaction (`withConnection`) so connection hold time is
 * bounded and the steps that the reused services already commit internally are not nested inside a
 * larger transaction.
 *
 * @param {GenerateSnapshotOptions} options Tar source, submission name, and optional secure list.
 * @returns {Promise<GenerateSnapshotResult>} The created submission and upload identifiers.
 */
export async function generateSnapshot(options: GenerateSnapshotOptions): Promise<GenerateSnapshotResult> {
  const { tarPath, submissionName } = options;

  // Step 1: Obtain the tar bytes and stage them in MinIO under the snapshot namespace.
  const tarBuffer = await readOrPackTarBuffer(tarPath);
  const objectKey = `${SEED_SNAPSHOT_PREFIX}/${submissionName}/archive.tar`;

  await new ObjectStorageService().uploadBuffer(BucketType.MAIN, tarBuffer, 'application/x-tar', objectKey);
  defaultLog.info({ label: 'generateSnapshot', message: 'staged tar to MinIO', objectKey, byteSize: tarBuffer.length });

  // Step 2: Remove any prior snapshot submission and artifact for this name so re-runs do not duplicate it.
  await withConnection((connection) => deletePriorSnapshot(connection, submissionName, objectKey));

  // Step 3: Seed the FK chain the ingestion pipeline expects.
  const chain = await withConnection((connection) =>
    seedFkChain(connection, { submissionName, objectKey, tarByteSize: tarBuffer.length })
  );
  defaultLog.info({
    label: 'generateSnapshot',
    message: 'seeded FK chain',
    submissionId: chain.submissionId,
    submissionUploadId: chain.submissionUploadId
  });

  // Step 4: Ingest. SubmissionIngestionService is not a DBService — it opens its own connections.
  await new SubmissionIngestionService().ingestSubmissionUpload({
    submission_upload_id: chain.submissionUploadId,
    submission_id: chain.submissionId,
    upload_id: chain.uploadId,
    team_id: chain.teamId,
    status: 'uploaded',
    ticket_id: chain.ticketId,
    blueprint_id: chain.blueprintId
  });
  defaultLog.info({ label: 'generateSnapshot', message: 'ingest complete', submissionId: chain.submissionId });

  // Step 5: Index the JSONB features into the typed property tables.
  await withConnection((connection) =>
    new SubmissionFeaturePropertyIngestionService(connection).indexSubmissionPropertiesBySubmissionUploadId(
      chain.submissionId,
      chain.submissionUploadId
    )
  );
  defaultLog.info({ label: 'generateSnapshot', message: 'index complete', submissionId: chain.submissionId });

  // Step 6: Compute the reachability closure for the upload.
  await withConnection((connection) =>
    new SubmissionFeatureClosureService(connection).computeClosureForUpload(chain.submissionUploadId)
  );
  defaultLog.info({ label: 'generateSnapshot', message: 'closure complete', submissionId: chain.submissionId });

  // Step 7: Transition the ingested features to "effective" — the real pipeline does this when an
  // upload's review is approved. Until record_effective_date is set, a feature is excluded by every
  // `record_effective_date <= now()` filter: it is invisible to search AND cannot be effectively
  // secured, so no scope anchors are computed for it. The generator approves the upload outright
  // because the snapshot is trusted seed data. This runs after the closure exists and before
  // securing, so the secured features are already effective when securing evaluates them.
  await withConnection((connection) =>
    new SubmissionFeatureService(connection).setRecordEffectiveDateBySubmissionUploadId(chain.submissionUploadId)
  );
  defaultLog.info({ label: 'generateSnapshot', message: 'features effective', submissionId: chain.submissionId });

  // Step 8: Secure the demo deployment subset, then compute anchors synchronously.
  // Securing only happens when the caller asks for it (the sampler run omits it); the Moose run
  // passes the default identifiers, or its own override.
  if (options.secureDeploymentIdentifiers !== undefined) {
    await secureDeploymentsAndComputeAnchors(chain.submissionId, options.secureDeploymentIdentifiers);
  }

  return { submissionId: chain.submissionId, submissionUploadId: chain.submissionUploadId };
}

/**
 * Read an external tar file, or pack the committed sampler source directory into a tar buffer.
 *
 * The sampler tar is intentionally not committed — the JSON source directory is the single source of
 * truth — so when `tarPath` points at a directory it is packed at runtime. Entries are written as
 * `features/...`, `codes/...`, and `files/...` so they match the scopes the ingestion parser reads
 * (`resolveScopedEntryName`).
 *
 * @param {string} tarPath A `.tar` file path or the sampler source directory.
 * @returns {Promise<Buffer>} The tar bytes ready to stage in object storage.
 */
async function readOrPackTarBuffer(tarPath: string): Promise<Buffer> {
  if (fs.statSync(tarPath).isFile()) {
    return fs.readFileSync(tarPath);
  }

  return packDirectoryToTarBuffer(tarPath);
}

/**
 * Pack a sampler source directory (`features/`, `codes/`, `files/`) into a tar buffer.
 *
 * @param {string} sourceDir The directory whose scoped subfolders are packed.
 * @returns {Promise<Buffer>} The packed tar bytes.
 */
function packDirectoryToTarBuffer(sourceDir: string): Promise<Buffer> {
  const pack = tar.pack();
  const chunks: Buffer[] = [];

  const scopes = ['features', 'codes', 'files'];
  for (const scope of scopes) {
    const scopeDir = path.join(sourceDir, scope);
    if (!fs.existsSync(scopeDir)) {
      continue;
    }

    for (const fileName of fs.readdirSync(scopeDir)) {
      const fileBuffer = fs.readFileSync(path.join(scopeDir, fileName));
      pack.entry({ name: `${scope}/${fileName}` }, fileBuffer);
    }
  }

  pack.finalize();

  return new Promise((resolve, reject) => {
    pack.on('data', (chunk: Buffer) => chunks.push(chunk));
    pack.on('end', () => resolve(Buffer.concat(chunks)));
    pack.on('error', reject);
  });
}

/**
 * Clear the prior snapshot for this name so a re-run does not duplicate the dataset or collide on keys.
 *
 * Soft-deletes the prior submission, then hard-deletes the prior artifact and its two bridge rows. The
 * artifact carries a UNIQUE (bucket, object_key) constraint and the staged object_key is deterministic
 * per name, so without this removal a second run fails on a duplicate-key violation when re-staging the
 * tar. The bridge rows are deleted in FK order (upload_artifact -> upload_archive -> artifact) because
 * upload_artifact references upload_archive, which in turn references artifact.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {string} submissionName The snapshot submission name to clear.
 * @param {string} objectKey The deterministic staged-tar object_key whose artifact is removed.
 * @returns {Promise<void>}
 */
async function deletePriorSnapshot(
  connection: IDBConnection,
  submissionName: string,
  objectKey: string
): Promise<void> {
  // Match on the clean name AND the generator marker so a real user submission that happens to share
  // the dataset name is never soft-deleted — only this generator's own prior run is cleared.
  await connection.sql(SQL`
    UPDATE submission
    SET record_end_date = now()
    WHERE name = ${submissionName}
      AND comment = ${SEED_SNAPSHOT_PREFIX}
      AND record_end_date IS NULL;
  `);

  // The pipeline also creates an upload_artifact row that points at the staged archive (via
  // upload_archive_id) but carries a different, derived artifact_id, so both linkages are cleared.
  await connection.sql(SQL`
    DELETE FROM upload_artifact
    WHERE artifact_id IN (SELECT artifact_id FROM artifact WHERE object_key = ${objectKey})
       OR upload_archive_id IN (
         SELECT upload_archive_id FROM upload_archive
         WHERE artifact_id IN (SELECT artifact_id FROM artifact WHERE object_key = ${objectKey})
       );
  `);

  await connection.sql(SQL`
    DELETE FROM upload_archive
    WHERE artifact_id IN (SELECT artifact_id FROM artifact WHERE object_key = ${objectKey});
  `);

  await connection.sql(SQL`
    DELETE FROM artifact WHERE object_key = ${objectKey};
  `);
}

interface SeedFkChainPayload {
  submissionName: string;
  objectKey: string;
  tarByteSize: number;
}

/**
 * Seed the submission/upload/artifact FK chain the ingestion pipeline reads.
 *
 * Resolves contributor and system-user context from the seeded rows (the seeded contributor and a
 * system user linked to it) rather than hardcoding ids — the prototype hardcoded 1/2, which breaks
 * the contributor lookup the indexer performs if those ids ever differ across environments.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {SeedFkChainPayload} payload Submission name and staged-tar metadata.
 * @returns {Promise<SeededFkChain>} The created identifiers.
 */
async function seedFkChain(connection: IDBConnection, payload: SeedFkChainPayload): Promise<SeededFkChain> {
  const { contributorId, systemUserId } = await resolveContributorContext(connection);
  const blueprintId = await resolveActiveBlueprintId(connection);
  const recordEndDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const bucket = process.env.OBJECT_STORE_BUCKET_NAME ?? null;

  const submissionTeamResult = await connection.sql(SQL`
    INSERT INTO team (name, description, create_user)
    VALUES (
      ${`${SEED_SNAPSHOT_PREFIX} submission team ${randomUUID()}`},
      'Auto-created access team for a seed snapshot submission.',
      ${systemUserId}
    )
    RETURNING team_id;
  `);
  const submissionTeamId: string = submissionTeamResult.rows[0].team_id;

  await connection.sql(SQL`
    INSERT INTO team_member (system_user_id, team_id, create_user)
    VALUES (${systemUserId}, ${submissionTeamId}, ${systemUserId});
  `);

  const submissionResult = await connection.sql(SQL`
    INSERT INTO submission (uuid, system_user_id, team_id, contributor_id, name, description, comment, create_user)
    VALUES (
      gen_random_uuid(),
      ${systemUserId},
      ${submissionTeamId},
      ${contributorId},
      ${payload.submissionName},
      ${SEED_SNAPSHOT_PREFIX},
      ${SEED_SNAPSHOT_PREFIX},
      ${systemUserId}
    )
    RETURNING submission_id;
  `);
  const submissionId: number = submissionResult.rows[0].submission_id;

  const uploadResult = await connection.sql(SQL`
    INSERT INTO upload (upload_status, record_end_date, create_user)
    VALUES ('completed', ${recordEndDate}, ${systemUserId})
    RETURNING upload_id;
  `);
  const uploadId: string = uploadResult.rows[0].upload_id;

  const artifactResult = await connection.sql(SQL`
    INSERT INTO artifact (bucket, object_key, byte_size, artifact_status, uploaded_at, format, create_user)
    VALUES (${bucket}, ${payload.objectKey}, ${payload.tarByteSize}, 'uploaded', now(), 'tar', ${systemUserId})
    RETURNING artifact_id;
  `);
  const artifactId: string = artifactResult.rows[0].artifact_id;

  await connection.sql(SQL`
    INSERT INTO upload_archive (upload_id, artifact_id, archive_status, create_user)
    VALUES (${uploadId}, ${artifactId}, 'completed', ${systemUserId});
  `);

  const ticketId = await createSnapshotTicket(connection, submissionId, uploadId, systemUserId);
  const teamResult = await connection.sql(SQL`
    INSERT INTO team (name, description, create_user)
    VALUES (
      ${`${SEED_SNAPSHOT_PREFIX} upload team ${uploadId}`},
      'Auto-created access team for a seed snapshot upload.',
      ${systemUserId}
    )
    RETURNING team_id;
  `);
  const teamId: string = teamResult.rows[0].team_id;

  await connection.sql(SQL`
    INSERT INTO team_member (system_user_id, team_id, create_user)
    VALUES (${systemUserId}, ${teamId}, ${systemUserId});
  `);

  const submissionUploadResult = await connection.sql(SQL`
    INSERT INTO submission_upload (submission_id, upload_id, team_id, ticket_id, blueprint_id, create_user)
    VALUES (${submissionId}, ${uploadId}, ${teamId}, ${ticketId}, ${blueprintId}, ${systemUserId})
    RETURNING submission_upload_id;
  `);
  const submissionUploadId: string = submissionUploadResult.rows[0].submission_upload_id;

  await connection.sql(SQL`
    INSERT INTO upload_artifact (upload_id, artifact_id, role, create_user)
    VALUES (${uploadId}, ${artifactId}, 'feature', ${systemUserId});
  `);

  // The real upload flow creates default pending reviews (validation + security); the indexing phase
  // transitions them pending -> requested, so they must exist before indexing runs.
  await connection.sql(SQL`
    INSERT INTO submission_upload_review (submission_upload_id, scope, status, requested_by, create_user)
    VALUES
      (${submissionUploadId}, 'validation', 'pending', ${systemUserId}, ${systemUserId}),
      (${submissionUploadId}, 'security', 'pending', ${systemUserId}, ${systemUserId});
  `);

  return { submissionId, uploadId, submissionUploadId, ticketId, teamId, blueprintId };
}

/**
 * Resolve the active blueprint the submission_upload must reference.
 *
 * submission_upload gained a required blueprint_id; the seed generator binds to the first active
 * blueprint (there is a single "Initial Blueprint" seeded today) rather than hardcoding an id.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @returns {Promise<number>} The active blueprint id.
 */
async function resolveActiveBlueprintId(connection: IDBConnection): Promise<number> {
  const response = await connection.sql(SQL`
    SELECT blueprint_id
    FROM blueprint
    WHERE record_end_date IS NULL
    ORDER BY blueprint_id
    LIMIT 1;
  `);

  if (response.rowCount === 0) {
    throw new Error('resolveActiveBlueprintId: no active blueprint was found');
  }

  return response.rows[0].blueprint_id;
}

/** Contributor + system-user ids resolved from the seeded rows. */
interface ContributorContext {
  contributorId: number;
  systemUserId: number;
}

/**
 * Resolve a seeded contributor and a system user linked to it.
 *
 * The indexer resolves the submission's contributor via contributor_system_user, so the seeded
 * submission must reference a contributor that has at least one linked active system user.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @returns {Promise<ContributorContext>} The resolved ids.
 */
async function resolveContributorContext(connection: IDBConnection): Promise<ContributorContext> {
  const response = await connection.sql(SQL`
    SELECT c.contributor_id, csu.system_user_id
    FROM contributor c
    JOIN contributor_system_user csu
      ON csu.contributor_id = c.contributor_id AND csu.record_end_date IS NULL
    WHERE c.record_end_date IS NULL
    ORDER BY c.contributor_id, csu.system_user_id
    LIMIT 1;
  `);

  if (response.rowCount === 0) {
    throw new Error('resolveContributorContext: no seeded contributor with a linked system user was found');
  }

  return {
    contributorId: response.rows[0].contributor_id,
    systemUserId: response.rows[0].system_user_id
  };
}

/**
 * Create a ticket (with a stable team and an open status) for the snapshot submission.
 *
 * The submission_upload bridge requires a ticket_id, and a ticket requires a team plus an opening
 * status row. A deterministic per-day slug is generated the same way the upload flow does.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission the ticket describes.
 * @param {string} uploadId The upload the ticket describes.
 * @param {number} systemUserId The audit user for the inserts.
 * @returns {Promise<string>} The created ticket id.
 */
async function createSnapshotTicket(
  connection: IDBConnection,
  submissionId: number,
  uploadId: string,
  systemUserId: number
): Promise<string> {
  const teamName = `${SEED_SNAPSHOT_PREFIX} ticket team`;

  const existingTeam = await connection.sql(SQL`
    SELECT team_id FROM team WHERE name = ${teamName} AND record_end_date IS NULL LIMIT 1;
  `);
  const teamId: string =
    existingTeam.rows[0]?.team_id ??
    (
      await connection.sql(SQL`
        INSERT INTO team (name, description, create_user)
        VALUES (${teamName}, 'Auto-created for the seed snapshot generator.', ${systemUserId})
        RETURNING team_id;
      `)
    ).rows[0].team_id;

  const slugResult = await connection.sql(SQL`
    WITH
      day_context AS (SELECT TO_CHAR((now() AT TIME ZONE 'UTC')::date, 'DDD') AS day_of_year),
      latest AS (
        SELECT COALESCE(MAX(RIGHT(ticket_slug, 5)::integer), -1) AS last_value
        FROM ticket, day_context
        WHERE ticket_slug LIKE day_context.day_of_year || '%'
      )
    SELECT day_of_year || LPAD((latest.last_value + 1)::text, 5, '0') AS ticket_slug
    FROM day_context, latest;
  `);
  const ticketSlug: string = slugResult.rows[0].ticket_slug;

  const ticketResult = await connection.sql(SQL`
    INSERT INTO ticket (ticket_slug, subject, description, team_id, create_user)
    VALUES (
      ${ticketSlug},
      'New Submission',
      ${`Submission ${submissionId}. Upload: ${uploadId}`},
      ${teamId},
      ${systemUserId}
    )
    RETURNING ticket_id;
  `);
  const ticketId: string = ticketResult.rows[0].ticket_id;

  await connection.sql(SQL`
    INSERT INTO ticket_status (ticket_id, status, create_user)
    VALUES (${ticketId}, 'open', ${systemUserId});
  `);

  return ticketId;
}

/**
 * Secure the demo deployment subset and compute their security-scope anchors synchronously.
 *
 * `patchSecurityRulesOnSubmissionFeatures` writes the security rows and only *enqueues* a pg-boss
 * anchor-compute job — it does not compute anchors inline. In run-once mode there is no worker
 * draining the queue, so those enqueued jobs sit inert and harmless; the synchronous anchor loop
 * below is the authoritative compute. Telemetry is never secured directly: it has no security row
 * and is hidden only because its ancestor deployment is secured and security cascades down the
 * closure ancestry path.
 *
 * @param {number} submissionId The submission whose deployments are secured.
 * @param {string[]} identifiers The animal_identifier values of the deployments to secure.
 * @returns {Promise<void>}
 */
async function secureDeploymentsAndComputeAnchors(submissionId: number, identifiers: string[]): Promise<void> {
  await withConnection(async (connection) => {
    const ruleId = await getSecurityRuleIdByName(connection, DEMO_SECURITY_RULE_NAME);
    const deployments = await getTelemetryDeployments(connection, submissionId);
    const deploymentFeatureIds = selectDeploymentsToSecure(deployments, identifiers);

    await logDeploymentTelemetryCounts(connection, submissionId, deployments, deploymentFeatureIds);

    // Never secure the dataset root — securing the root cascades through the closure (self-or-ancestor)
    // and locks every feature in the submission, defeating the partial-secure demo. Only the deployment
    // subset is secured here.
    await new SecurityService(connection).patchSecurityRulesOnSubmissionFeatures(
      submissionId,
      deploymentFeatureIds,
      [ruleId],
      []
    );

    // Also secure the study_area, which activates the seed's otherwise-dormant Sampling Sites policy as a
    // second, top-level lock demo. The study_area has no descendants, so this locks exactly one feature
    // (no cascade); the anchor computation below binds it under the urn:*:study_area:* scope automatically.
    const studyAreaRuleId = await getSecurityRuleIdByName(connection, STUDY_AREA_SECURITY_RULE_NAME);
    const studyAreaFeatureIds = await getStudyAreaFeatureIds(connection, submissionId);
    if (studyAreaFeatureIds.length > 0) {
      await new SecurityService(connection).patchSecurityRulesOnSubmissionFeatures(
        submissionId,
        studyAreaFeatureIds,
        [studyAreaRuleId],
        []
      );
    }

    await computeAnchorsForSubmission(connection, submissionId);
  });
}

/**
 * Resolve a security rule id by name from the active rules.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {string} ruleName The security_rule name to resolve.
 * @returns {Promise<number>} The matching security_rule_id.
 */
async function getSecurityRuleIdByName(connection: IDBConnection, ruleName: string): Promise<number> {
  const response = await connection.sql(SQL`
    SELECT security_rule_id
    FROM security_rule
    WHERE name = ${ruleName}
      AND record_end_date IS NULL;
  `);

  return assertRuleRow(response.rows, ruleName);
}

/**
 * Read the study_area feature ids for a submission.
 *
 * Returned as an array (rather than a single id) so the caller stays agnostic to how many study_area
 * features a dataset has; the Boreal Moose snapshot has exactly one.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<number[]>} The active study_area feature ids.
 */
async function getStudyAreaFeatureIds(connection: IDBConnection, submissionId: number): Promise<number[]> {
  const response = await connection.sql(SQL`
    SELECT sf.submission_feature_id
    FROM submission_feature sf
    JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id AND ft.name = 'study_area'
    WHERE sf.submission_id = ${submissionId}
      AND sf.record_end_date IS NULL;
  `);

  return response.rows.map((row) => row.submission_feature_id);
}

/**
 * Read all telemetry_deployment features for a submission with their animal_identifier and device_key.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<DeploymentRow[]>} One row per active deployment.
 */
async function getTelemetryDeployments(connection: IDBConnection, submissionId: number): Promise<DeploymentRow[]> {
  const response = await connection.sql(SQL`
    SELECT
      sf.submission_feature_id,
      animal.value AS animal_identifier,
      device.value AS device_key
    FROM submission_feature sf
    JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id AND ft.name = 'telemetry_deployment'
    LEFT JOIN submission_feature_property_string animal
      ON animal.submission_feature_id = sf.submission_feature_id
      AND animal.feature_type_property_id IN (
        SELECT ftp.feature_type_property_id
        FROM feature_type_property ftp
        JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
        WHERE fp.name = 'animal_identifier'
      )
    LEFT JOIN submission_feature_property_string device
      ON device.submission_feature_id = sf.submission_feature_id
      AND device.feature_type_property_id IN (
        SELECT ftp.feature_type_property_id
        FROM feature_type_property ftp
        JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
        WHERE fp.name = 'device_key'
      )
    WHERE sf.submission_id = ${submissionId}
      AND sf.record_end_date IS NULL;
  `);

  return response.rows.map((row) => ({
    submission_feature_id: row.submission_feature_id,
    animal_identifier: row.animal_identifier,
    device_key: row.device_key
  }));
}

/**
 * Log per-deployment telemetry counts and the secured total so the demo split is visible.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @param {DeploymentRow[]} deployments All deployments in the submission.
 * @param {number[]} securedFeatureIds The deployment feature ids being secured.
 * @returns {Promise<void>}
 */
async function logDeploymentTelemetryCounts(
  connection: IDBConnection,
  submissionId: number,
  deployments: DeploymentRow[],
  securedFeatureIds: number[]
): Promise<void> {
  const securedSet = new Set(securedFeatureIds);
  let securedTelemetryTotal = 0;

  for (const deployment of deployments) {
    const response = await connection.sql(SQL`
      SELECT count(*)::int AS count
      FROM submission_feature telemetry
      JOIN feature_type ft ON ft.feature_type_id = telemetry.feature_type_id AND ft.name = 'telemetry'
      WHERE telemetry.parent_submission_feature_id = ${deployment.submission_feature_id}
        AND telemetry.record_end_date IS NULL;
    `);
    const telemetryCount: number = response.rows[0].count;
    const secured = securedSet.has(deployment.submission_feature_id);
    if (secured) {
      securedTelemetryTotal += telemetryCount;
    }

    defaultLog.info({
      label: 'secureDeployments',
      message: 'deployment telemetry count',
      submissionId,
      deploymentFeatureId: deployment.submission_feature_id,
      animalIdentifier: deployment.animal_identifier,
      telemetryCount,
      secured
    });
  }

  defaultLog.info({
    label: 'secureDeployments',
    message: 'secured telemetry total',
    submissionId,
    securedDeploymentCount: securedFeatureIds.length,
    securedTelemetryTotal
  });
}

/**
 * Compute security-scope anchors synchronously for every scope matching the submission.
 *
 * Inlines the keyset-bounded batch loop (cursor by afterId, fixed LIMIT per batch) rather than
 * importing the integration-test helper — committed tooling must not depend on `__integration__`
 * code. Each scope is resolved to its URN once, then batches advance the cursor until exhausted.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission whose matching scopes are computed.
 * @returns {Promise<void>}
 */
async function computeAnchorsForSubmission(connection: IDBConnection, submissionId: number): Promise<void> {
  const scopeRepo = new SecurityScopeRepository(connection);
  const scopes = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

  for (const scope of scopes) {
    const urn = await scopeRepo.resolveUrnForScope(scope.security_scope_id);
    if (!urn) {
      continue;
    }

    let afterId = 0;
    while (true) {
      const batch = await scopeRepo.computeAnchorBatch(scope.security_scope_id, urn, afterId);
      if (!batch) {
        break;
      }
      afterId = batch.pageLastId;
    }
  }
}
