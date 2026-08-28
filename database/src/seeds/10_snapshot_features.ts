import { Knex } from 'knex';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Replay committed golden-snapshot fixtures into the real feature tables (pure knex, no `api` import).
 *
 * The fixtures under `fixtures/seed-features/` were produced once by the api-context generator
 * (`api/src/seed-data-generator/`), which ran the real ingestion pipeline (ingest -> index -> closure),
 * secured a subset of telemetry deployments, and computed security-scope anchors, then dumped every row
 * keyed by a stable natural key (uuid / object_key / scope_hash / resolved name) rather than by the
 * volatile identity/serial columns. This seed rebuilds each submission with fresh ids, remaps every FK
 * through the natural keys, and asserts per-table row counts so an incomplete replay fails loudly.
 *
 * Ordering: this runs after `07_access_policy` (filename `07` < `10`), which creates the `security_scope`
 * rows the anchor remap binds against by `scope_hash`.
 */

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'seed-features');

/** Rows-per-statement for the bulk inserts of the ~7,750-feature snapshot (CLAUDE.md scale carve-out). */
const BATCH_SIZE = 1000;

// The fixture types mirror `api/src/seed-data-generator/dump.ts`. They are re-declared here rather than
// imported because the `database` seed package cannot import `api`; the committed JSON is the contract
// between the two packages.

interface SnapshotSubmission {
  name: string;
  description: string | null;
  comment: string | null;
}

interface SnapshotFeature {
  uuid: string;
  feature_type_name: string;
  parent_uuid: string | null;
  source_id: string | null;
  urn: string | null;
  data: unknown;
  data_byte_size: number | string | null;
}

interface SnapshotScalarProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  value: string | number | boolean | null;
}

interface SnapshotTimestampProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  date_value: string | null;
  time_value: string | null;
}

interface SnapshotTaxonProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  taxon_id: number;
}

interface SnapshotGeometryProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  geojson: unknown;
}

interface SnapshotFeatureProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  referenced_feature_uuid: string;
}

interface SnapshotClosureEdge {
  source_uuid: string;
  target_uuid: string;
  is_ancestor: boolean;
}

interface SnapshotFeatureFeatureEdge {
  source_uuid: string;
  target_uuid: string;
}

interface SnapshotArtifact {
  feature_uuid: string;
  object_key: string;
}

interface SnapshotSecurity {
  feature_uuid: string;
  security_rule_name: string;
}

interface SnapshotAnchor {
  feature_uuid: string;
  scope_hash: string;
}

interface SnapshotCounts {
  features: number;
  property_string: number;
  property_number: number;
  property_boolean: number;
  property_timestamp: number;
  property_code: number;
  property_taxon: number;
  property_geometry: number;
  property_feature: number;
  closure: number;
  feature_feature: number;
  artifact: number;
  security: number;
  anchors: number;
}

interface SnapshotFixture {
  submission: SnapshotSubmission;
  features: SnapshotFeature[];
  property_string: SnapshotScalarProperty[];
  property_number: SnapshotScalarProperty[];
  property_boolean: SnapshotScalarProperty[];
  property_timestamp: SnapshotTimestampProperty[];
  property_code: unknown[];
  property_taxon: SnapshotTaxonProperty[];
  property_geometry: SnapshotGeometryProperty[];
  property_feature: SnapshotFeatureProperty[];
  closure: SnapshotClosureEdge[];
  feature_feature: SnapshotFeatureFeatureEdge[];
  artifact: SnapshotArtifact[];
  security: SnapshotSecurity[];
  anchors: SnapshotAnchor[];
  counts: SnapshotCounts;
}

/** Context resolved from earlier seeds/migrations, shared across a fixture's inserts. */
interface SeedContext {
  systemUserId: number;
  contributorId: number;
  blueprintId: number;
  featureTypeIdByName: Map<string, number>;
}

/** The FK-chain ids created for one snapshot submission. */
interface FkChain {
  submissionId: number;
  submissionUploadId: string;
  artifactIdByObjectKey: Map<string, string>;
}

/** Minimal ITIS-backed taxonomy records referenced by the committed snapshot features. */
const SNAPSHOT_TAXA = [
  {
    itisTsn: 177925,
    parentItisTsn: 177920,
    scientificName: 'Strix occidentalis',
    rank: 'Species',
    commonName: 'Spotted Owl'
  },
  { itisTsn: 180702, parentItisTsn: 1277211, scientificName: 'Alces', rank: 'Genus', commonName: 'Moose' },
  {
    itisTsn: 180703,
    parentItisTsn: 180702,
    scientificName: 'Alces alces',
    rank: 'Species',
    commonName: 'Moose'
  },
  {
    itisTsn: 180701,
    parentItisTsn: 180700,
    scientificName: 'Rangifer tarandus',
    rank: 'Species',
    commonName: 'Caribou'
  },
  {
    itisTsn: 625197,
    parentItisTsn: 180701,
    scientificName: 'Rangifer tarandus tarandus',
    rank: 'Subspecies',
    commonName: 'Caribou'
  }
] as const;

export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`SET SCHEMA 'biohub'; SET SEARCH_PATH = 'biohub','public';`);

  // Taxa are cached by the application during normal ingestion. Snapshot replay bypasses that API path,
  // so seed the referenced cache records explicitly before replaying (or skipping) the submissions.
  await seedSnapshotTaxa(knex);

  for (const fixtureName of loadFixtureIndex()) {
    const fixture = loadFixture(fixtureName);

    if (await isAlreadySeeded(knex, fixture.submission)) {
      continue;
    }

    await knex.transaction(async (trx) => {
      // Re-assert the search path on the transaction's own connection: SET SEARCH_PATH is
      // session-scoped and the transaction may be handed a different pooled connection than the
      // one the outer SET ran on, so every unqualified table name below depends on this.
      await trx.raw(`SET SCHEMA 'biohub'; SET SEARCH_PATH = 'biohub','public';`);

      const context = await resolveSeedContext(trx, fixture);
      const chain = await createFkChain(trx, fixture, context);
      const idMap = await insertFeatures(trx, fixture, chain, context);

      await insertProperties(trx, fixture, idMap, context);
      await insertClosureAndEdges(trx, fixture, idMap, context);
      await insertArtifactLinks(trx, fixture, idMap, chain, context);
      await insertSecurity(trx, fixture, idMap, context);
      await insertAnchors(trx, fixture, idMap);

      await assertReplayedCounts(trx, fixture, chain.submissionId);
    });
  }
}

/**
 * Seed the taxonomy cache entries referenced by snapshot feature payloads.
 *
 * This runs before the snapshot idempotency check so an existing local snapshot can acquire missing
 * taxonomy data simply by rerunning the seeds. Existing active cache records are always preserved.
 */
async function seedSnapshotTaxa(knex: Knex): Promise<void> {
  const systemUser = await knex('system_user')
    .select('system_user_id')
    .whereNull('record_end_date')
    .orderBy('system_user_id')
    .first();

  if (!systemUser) {
    throw new Error('seed 10: no active system user was found for snapshot taxonomy');
  }

  for (const taxon of SNAPSHOT_TAXA) {
    const existing = await knex('taxon')
      .select('taxon_id')
      .where({ itis_tsn: taxon.itisTsn })
      .whereNull('record_end_date')
      .first();

    if (existing) {
      continue;
    }

    await knex('taxon').insert({
      itis_tsn: taxon.itisTsn,
      parent_itis_tsn: taxon.parentItisTsn,
      itis_scientific_name: taxon.scientificName,
      rank: taxon.rank,
      common_name: taxon.commonName,
      itis_data: JSON.stringify({
        tsn: String(taxon.itisTsn),
        parentTSN: String(taxon.parentItisTsn),
        scientificName: taxon.scientificName,
        rank: taxon.rank,
        commonName: taxon.commonName,
        source: 'ITIS snapshot seed'
      }),
      itis_update_date: knex.fn.now(),
      create_user: systemUser.system_user_id
    });
  }

  // Preserve the stable ITIS relationship separately from the database FK, then resolve the FK only
  // when the immediate parent also has an active row in this cache. This also repairs pre-existing rows
  // when seeds are rerun; their raw ITIS payloads already contain `parentTSN`.
  await knex.raw(`--sql
    UPDATE taxon AS child
    SET parent_itis_tsn = NULLIF(child.itis_data->>'parentTSN', '')::integer
    WHERE child.record_end_date IS NULL
      AND child.itis_data->>'parentTSN' IS NOT NULL
      AND child.parent_itis_tsn IS DISTINCT FROM NULLIF(child.itis_data->>'parentTSN', '')::integer;

    UPDATE taxon AS child
    SET parent_taxon_id = parent.taxon_id
    FROM taxon AS parent
    WHERE child.parent_itis_tsn = parent.itis_tsn
      AND child.record_end_date IS NULL
      AND parent.record_end_date IS NULL
      AND child.parent_taxon_id IS DISTINCT FROM parent.taxon_id;
  `);
}

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

/** Read the ordered list of fixture files to replay from the committed index. */
function loadFixtureIndex(): string[] {
  const index = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'index.json'), 'utf8'));

  return index.fixtures;
}

/** Read and parse a single snapshot fixture file. */
function loadFixture(fixtureName: string): SnapshotFixture {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fixtureName), 'utf8'));
}

/**
 * True when this snapshot submission is already present and active.
 *
 * The full seed set runs on every environment setup; keying idempotency on the submission's name makes
 * re-running a no-op instead of duplicating the whole dataset (the generator prototype this derives from
 * had no cleanup and stacked duplicate submissions on every run). The `__seed-snapshot__` marker
 * (carried in `description`) is required as well so a coincidentally same-named real submission is not
 * mistaken for the seed and does not suppress the replay.
 */
async function isAlreadySeeded(knex: Knex, submission: SnapshotSubmission): Promise<boolean> {
  const existing = await knex('submission')
    .select('submission_id')
    .where({ name: submission.name, description: submission.description ?? '' })
    .whereNull('record_end_date')
    .first();

  return Boolean(existing);
}

// ---------------------------------------------------------------------------
// Context + FK chain
// ---------------------------------------------------------------------------

/**
 * Resolve the ids the replay binds new rows to: a seeded contributor + linked system user, the active
 * blueprint, and a feature-type-name -> id map.
 *
 * Feature types are resolved preferring the active row (`record_end_date IS NULL DESC` first). The
 * snapshot's root feature type is `survey` — the canonical root type since `dataset` was retired in the
 * `add_survey_feature_type` migration — so it resolves to the active `survey` row. The ordering also
 * stays retired-tolerant, falling back to a retained row should any fixture ever reference a retired type.
 */
async function resolveSeedContext(knex: Knex, fixture: SnapshotFixture): Promise<SeedContext> {
  const contributor = await knex('contributor as c')
    .join('contributor_system_user as csu', function () {
      this.on('csu.contributor_id', 'c.contributor_id').andOnNull('csu.record_end_date');
    })
    .whereNull('c.record_end_date')
    .orderBy(['c.contributor_id', 'csu.system_user_id'])
    .select('c.contributor_id', 'csu.system_user_id')
    .first();

  if (!contributor) {
    throw new Error('seed 10: no seeded contributor with a linked system user was found');
  }

  const blueprint = await knex('blueprint')
    .select('blueprint_id')
    .whereNull('record_end_date')
    .orderBy('blueprint_id')
    .first();

  if (!blueprint) {
    throw new Error('seed 10: no active blueprint was found');
  }

  const featureTypeNames = [...new Set(fixture.features.map((feature) => feature.feature_type_name))];
  const featureTypeIdByName = new Map<string, number>();

  for (const name of featureTypeNames) {
    const row = await knex('feature_type')
      .select('feature_type_id')
      .where({ name })
      .orderByRaw('record_end_date IS NULL DESC, feature_type_id DESC')
      .first();

    if (!row) {
      throw new Error(`seed 10: feature_type '${name}' not found`);
    }

    featureTypeIdByName.set(name, row.feature_type_id);
  }

  return {
    systemUserId: contributor.system_user_id,
    contributorId: contributor.contributor_id,
    blueprintId: blueprint.blueprint_id,
    featureTypeIdByName
  };
}

/**
 * Rebuild the submission/upload/artifact/ticket FK chain the feature rows reference.
 *
 * Only the rows the snapshot's features actually depend on are created (submission, upload,
 * submission_upload + its required ticket/team, and one artifact per referenced object_key). The staged
 * tar and upload_archive/upload_artifact bookkeeping the ingestion pipeline produced are not recreated —
 * a pure replay never re-ingests, and raw file download is out of scope (the object is not staged
 * locally, so it 404s by design).
 */
async function createFkChain(knex: Knex, fixture: SnapshotFixture, context: SeedContext): Promise<FkChain> {
  const [submissionTeam] = await knex('team')
    .insert({
      name: `Seed Snapshot Submission Team ${fixture.submission.name}`,
      description: 'Dedicated access team for a golden-snapshot submission.',
      create_user: context.systemUserId
    })
    .returning('team_id');
  await knex('team_member').insert({
    system_user_id: context.systemUserId,
    team_id: submissionTeam.team_id,
    create_user: context.systemUserId
  });

  const [submission] = await knex('submission')
    .insert({
      uuid: knex.raw('gen_random_uuid()'),
      system_user_id: context.systemUserId,
      team_id: submissionTeam.team_id,
      contributor_id: context.contributorId,
      name: fixture.submission.name,
      description: fixture.submission.description ?? '',
      comment: fixture.submission.comment ?? '',
      create_user: context.systemUserId
    })
    .returning('submission_id');

  const [upload] = await knex('upload')
    .insert({
      upload_status: 'completed',
      record_end_date: knex.fn.now(),
      create_user: context.systemUserId
    })
    .returning('upload_id');

  const ticketId = await createSnapshotTicket(knex, context.systemUserId);
  const [uploadTeam] = await knex('team')
    .insert({
      name: `Seed Snapshot Upload Team ${upload.upload_id}`,
      description: 'Dedicated access team for a golden-snapshot upload.',
      create_user: context.systemUserId
    })
    .returning('team_id');
  await knex('team_member').insert({
    system_user_id: context.systemUserId,
    team_id: uploadTeam.team_id,
    create_user: context.systemUserId
  });

  const [submissionUpload] = await knex('submission_upload')
    .insert({
      submission_id: submission.submission_id,
      upload_id: upload.upload_id,
      team_id: uploadTeam.team_id,
      ticket_id: ticketId,
      blueprint_id: context.blueprintId,
      create_user: context.systemUserId
    })
    .returning('submission_upload_id');

  const artifactIdByObjectKey = await createArtifacts(knex, fixture, context);

  return {
    submissionId: submission.submission_id,
    submissionUploadId: submissionUpload.submission_upload_id,
    artifactIdByObjectKey
  };
}

/**
 * Create the minimal team + ticket + opening status the submission_upload bridge requires.
 *
 * `ticket_slug` is constrained to exactly eight digits and must be unique; the day-of-year + zero-padded
 * counter form mirrors how the real upload flow mints slugs. Idempotency is handled upstream (the whole
 * fixture is skipped when already present), so this only runs on a fresh seed.
 */
async function createSnapshotTicket(knex: Knex, systemUserId: number): Promise<string> {
  const teamName = 'Seed Snapshot Team';

  const existingTeam = await knex('team')
    .select('team_id')
    .where({ name: teamName })
    .whereNull('record_end_date')
    .first();
  const teamId =
    existingTeam?.team_id ??
    (
      await knex('team')
        .insert({
          name: teamName,
          description: 'Owns the golden-snapshot seed submissions.',
          create_user: systemUserId
        })
        .returning('team_id')
    )[0].team_id;

  const slugResult = await knex.raw(
    `WITH
       day_context AS (SELECT TO_CHAR((now() AT TIME ZONE 'UTC')::date, 'DDD') AS day_of_year),
       latest AS (
         SELECT COALESCE(MAX(RIGHT(ticket_slug, 5)::integer), -1) AS last_value
         FROM ticket, day_context
         WHERE ticket_slug LIKE day_context.day_of_year || '%'
       )
     SELECT day_of_year || LPAD((latest.last_value + 1)::text, 5, '0') AS ticket_slug
     FROM day_context, latest;`
  );
  const ticketSlug: string = slugResult.rows[0].ticket_slug;

  const [ticket] = await knex('ticket')
    .insert({
      ticket_slug: ticketSlug,
      subject: 'Seed Snapshot',
      description: 'Auto-created for the golden-snapshot seed replay.',
      team_id: teamId,
      create_user: systemUserId
    })
    .returning('ticket_id');

  await knex('ticket_status').insert({ ticket_id: ticket.ticket_id, status: 'open', create_user: systemUserId });

  return ticket.ticket_id;
}

/** Create one artifact row per object_key the snapshot's features link to, returning object_key -> id. */
async function createArtifacts(
  knex: Knex,
  fixture: SnapshotFixture,
  context: SeedContext
): Promise<Map<string, string>> {
  const bucket = process.env.OBJECT_STORE_BUCKET_NAME ?? 'local';
  const artifactIdByObjectKey = new Map<string, string>();

  for (const objectKey of new Set(fixture.artifact.map((row) => row.object_key))) {
    const [artifact] = await knex('artifact')
      .insert({
        bucket,
        object_key: objectKey,
        artifact_status: 'uploaded',
        uploaded_at: knex.fn.now(),
        format: 'zip',
        create_user: context.systemUserId
      })
      .returning('artifact_id');

    artifactIdByObjectKey.set(objectKey, artifact.artifact_id);
  }

  return artifactIdByObjectKey;
}

// ---------------------------------------------------------------------------
// Features + property tables
// ---------------------------------------------------------------------------

/**
 * Insert every feature and return a stable `uuid -> new submission_feature_id` map.
 *
 * Features are inserted with a null parent first, then the self-FK is set in a second pass, so the
 * insert order is independent of the parent/child ordering in the fixture. `record_effective_date` is
 * set to now and `record_end_date` left null on every row: the fixture deliberately omits these dates,
 * and without them the pipeline's `record_effective_date <= now()` filter would exclude every feature —
 * making the seeded data invisible to search and leaving it unsecured (no anchors resolve).
 */
async function insertFeatures(
  knex: Knex,
  fixture: SnapshotFixture,
  chain: FkChain,
  context: SeedContext
): Promise<Map<string, number>> {
  const effectiveDate = new Date().toISOString();

  const rows = fixture.features.map((feature) => ({
    uuid: feature.uuid,
    submission_id: chain.submissionId,
    submission_upload_id: chain.submissionUploadId,
    feature_type_id: resolveOrThrow(context.featureTypeIdByName, feature.feature_type_name, 'feature_type'),
    source_id: feature.source_id,
    urn: feature.urn,
    data: JSON.stringify(feature.data),
    data_byte_size: feature.data_byte_size,
    parent_submission_feature_id: null,
    record_effective_date: effectiveDate,
    create_user: context.systemUserId
  }));

  const inserted: { uuid: string; submission_feature_id: number }[] = await knex
    .batchInsert('submission_feature', rows, BATCH_SIZE)
    .returning(['uuid', 'submission_feature_id']);

  const idMap = buildUuidIdMap(inserted);

  await remapFeatureParents(knex, fixture, idMap);

  return idMap;
}

/** Set each feature's parent self-FK from the uuid map via chunked bulk updates. */
async function remapFeatureParents(knex: Knex, fixture: SnapshotFixture, idMap: Map<string, number>): Promise<void> {
  const pairs = fixture.features
    .filter((feature) => feature.parent_uuid !== null)
    .map((feature) => ({
      childId: resolveOrThrow(idMap, feature.uuid, 'feature'),
      parentId: resolveOrThrow(idMap, feature.parent_uuid as string, 'parent feature')
    }));

  for (const chunk of toChunks(pairs, BATCH_SIZE)) {
    const placeholders = chunk.map(() => '(?::int, ?::int)').join(', ');
    const bindings = chunk.flatMap((pair) => [pair.childId, pair.parentId]);

    await knex.raw(
      `UPDATE submission_feature sf
       SET parent_submission_feature_id = m.parent_id
       FROM (VALUES ${placeholders}) AS m(child_id, parent_id)
       WHERE sf.submission_feature_id = m.child_id`,
      bindings
    );
  }
}

/**
 * Insert all typed property tables, remapping the owning (and referenced) feature uuids to new ids.
 *
 * `property_code` and `property_taxon` are not replayed: their FKs are per-upload surrogate ids
 * (`contributor_codeset_code_id`; and the ITIS taxon surrogate PK, not the stable `itis_tsn`), not stable
 * natural keys, so a pure replay has nothing to rebind them to. The dump therefore emits them empty, the
 * fixture carries no such rows, and assertReplayedCounts asserts both at 0 as a guard. Every value-bearing
 * table — geometry, timestamp, closure, security, anchors across all ~7,716 telemetry features — is
 * replayed. Restoring code/taxon would need a dump that captures the natural keys (`itis_tsn`, codeset
 * name) plus the referenced taxa seeded into `taxon` first.
 */
async function insertProperties(
  knex: Knex,
  fixture: SnapshotFixture,
  idMap: Map<string, number>,
  context: SeedContext
): Promise<void> {
  await insertScalarProperty(knex, 'submission_feature_property_string', fixture.property_string, idMap, context);
  await insertScalarProperty(knex, 'submission_feature_property_number', fixture.property_number, idMap, context);
  await insertScalarProperty(knex, 'submission_feature_property_boolean', fixture.property_boolean, idMap, context);

  await insertTimestampProperty(knex, fixture, idMap, context);
  await insertGeometryProperty(knex, fixture, idMap, context);
  await insertFeatureProperty(knex, fixture, idMap, context);
}

/** Insert a scalar property table (string/number/boolean), which share a single `value` column. */
async function insertScalarProperty(
  knex: Knex,
  table: string,
  properties: SnapshotScalarProperty[],
  idMap: Map<string, number>,
  context: SeedContext
): Promise<void> {
  const rows = properties.map((property) => ({
    submission_feature_id: resolveOrThrow(idMap, property.feature_uuid, 'property feature'),
    feature_type_property_id: property.feature_type_property_id,
    value: property.value,
    create_user: context.systemUserId
  }));

  await knex.batchInsert(table, rows, BATCH_SIZE);
}

/** Insert the timestamp property table (split date_value + time_value columns). */
async function insertTimestampProperty(
  knex: Knex,
  fixture: SnapshotFixture,
  idMap: Map<string, number>,
  context: SeedContext
): Promise<void> {
  const rows = fixture.property_timestamp.map((property) => ({
    submission_feature_id: resolveOrThrow(idMap, property.feature_uuid, 'timestamp property feature'),
    feature_type_property_id: property.feature_type_property_id,
    date_value: property.date_value,
    time_value: property.time_value,
    create_user: context.systemUserId
  }));

  await knex.batchInsert('submission_feature_property_timestamp', rows, BATCH_SIZE);
}

/**
 * Insert the geometry property table, re-hydrating GeoJSON back to PostGIS geometry.
 *
 * The dump emitted each geometry as GeoJSON via `ST_AsGeoJSON`; it is re-inserted through
 * `ST_Force2D(ST_GeomFromGeoJSON(...))` to match the 2D geometry the indexer stores (storing Z/M would
 * diverge from indexer output). batchInsert cannot carry raw SQL values, so rows are inserted in manual
 * chunks with a raw `value` expression.
 */
async function insertGeometryProperty(
  knex: Knex,
  fixture: SnapshotFixture,
  idMap: Map<string, number>,
  context: SeedContext
): Promise<void> {
  for (const chunk of toChunks(fixture.property_geometry, BATCH_SIZE)) {
    const rows = chunk.map((property) => ({
      submission_feature_id: resolveOrThrow(idMap, property.feature_uuid, 'geometry property feature'),
      feature_type_property_id: property.feature_type_property_id,
      value: knex.raw('public.ST_Force2D(public.ST_GeomFromGeoJSON(?))', [JSON.stringify(property.geojson)]),
      create_user: context.systemUserId
    }));

    await knex('submission_feature_property_geometry').insert(rows);
  }
}

/** Insert the feature-reference property table, double-remapping both the owning and referenced feature. */
async function insertFeatureProperty(
  knex: Knex,
  fixture: SnapshotFixture,
  idMap: Map<string, number>,
  context: SeedContext
): Promise<void> {
  const rows = fixture.property_feature.map((property) => ({
    submission_feature_id: resolveOrThrow(idMap, property.feature_uuid, 'feature property owner'),
    feature_type_property_id: property.feature_type_property_id,
    referenced_submission_feature_id: resolveOrThrow(
      idMap,
      property.referenced_feature_uuid,
      'feature property target'
    ),
    create_user: context.systemUserId
  }));

  await knex.batchInsert('submission_feature_property_feature', rows, BATCH_SIZE);
}

// ---------------------------------------------------------------------------
// Closure, content edges, artifacts, security, anchors
// ---------------------------------------------------------------------------

/** Insert the reachability closure and content edges, remapping both endpoints of every edge. */
async function insertClosureAndEdges(
  knex: Knex,
  fixture: SnapshotFixture,
  idMap: Map<string, number>,
  context: SeedContext
): Promise<void> {
  const closureRows = fixture.closure.map((edge) => ({
    source_submission_feature_id: resolveOrThrow(idMap, edge.source_uuid, 'closure source'),
    target_submission_feature_id: resolveOrThrow(idMap, edge.target_uuid, 'closure target'),
    is_ancestor: edge.is_ancestor
  }));

  await knex.batchInsert('submission_feature_closure', closureRows, BATCH_SIZE);

  const edgeRows = fixture.feature_feature.map((edge) => ({
    source_feature_id: resolveOrThrow(idMap, edge.source_uuid, 'content edge source'),
    target_feature_id: resolveOrThrow(idMap, edge.target_uuid, 'content edge target'),
    create_user: context.systemUserId
  }));

  await knex.batchInsert('submission_feature_feature', edgeRows, BATCH_SIZE);
}

/** Link features to their artifacts, remapping the feature uuid and the artifact object_key to new ids. */
async function insertArtifactLinks(
  knex: Knex,
  fixture: SnapshotFixture,
  idMap: Map<string, number>,
  chain: FkChain,
  context: SeedContext
): Promise<void> {
  const rows = fixture.artifact.map((link) => ({
    submission_feature_id: resolveOrThrow(idMap, link.feature_uuid, 'artifact feature'),
    artifact_id: resolveOrThrow(chain.artifactIdByObjectKey, link.object_key, 'artifact object_key'),
    create_user: context.systemUserId
  }));

  await knex.batchInsert('submission_feature_artifact', rows, BATCH_SIZE);
}

/**
 * Apply the per-feature security rows, resolving each rule by name.
 *
 * The rule is resolved by name (retired-tolerant) rather than by id: rule ids are assigned by migration
 * order and shift across environments, so binding by id risks applying the wrong rule.
 */
async function insertSecurity(
  knex: Knex,
  fixture: SnapshotFixture,
  idMap: Map<string, number>,
  context: SeedContext
): Promise<void> {
  if (fixture.security.length === 0) {
    return;
  }

  const ruleNames = [...new Set(fixture.security.map((row) => row.security_rule_name))];
  const ruleIdByName = new Map<string, number>();

  for (const name of ruleNames) {
    const rule = await knex('security_rule')
      .select('security_rule_id')
      .where({ name })
      .orderByRaw('record_end_date IS NULL DESC, security_rule_id DESC')
      .first();

    if (!rule) {
      throw new Error(`seed 10: security_rule '${name}' not found`);
    }

    ruleIdByName.set(name, rule.security_rule_id);
  }

  const rows = fixture.security.map((row) => ({
    submission_feature_id: resolveOrThrow(idMap, row.feature_uuid, 'security feature'),
    security_rule_id: resolveOrThrow(ruleIdByName, row.security_rule_name, 'security_rule'),
    create_user: context.systemUserId
  }));

  await knex.batchInsert('submission_feature_security', rows, BATCH_SIZE);
}

/**
 * Insert the security-scope anchors, rebinding each to this run's live scope by `scope_hash`.
 *
 * The global `security_scope_id` is regenerated on every replay (07 recreates the scopes), so anchors
 * are bound to the live scope via `scope_hash` (sha256 of the scope URN, its stable natural key) plus the
 * `uuid -> feature id` remap. An anchor whose scope_hash has no live scope fails the seed rather than
 * inserting a dangling reference.
 */
async function insertAnchors(knex: Knex, fixture: SnapshotFixture, idMap: Map<string, number>): Promise<void> {
  if (fixture.anchors.length === 0) {
    return;
  }

  const scopes = await knex('security_scope').select('security_scope_id', 'scope_hash');
  const scopeIdByHash = new Map<string, string>(scopes.map((scope) => [scope.scope_hash, scope.security_scope_id]));

  const rows = remapAnchorRows(fixture.anchors, idMap, scopeIdByHash);

  await knex.batchInsert('security_scope_anchor', rows, BATCH_SIZE);
}

// ---------------------------------------------------------------------------
// Pure helpers (remap + assertion)
// ---------------------------------------------------------------------------

/** Build the `uuid -> new submission_feature_id` remap table from the inserted rows. */
export function buildUuidIdMap(rows: { uuid: string; submission_feature_id: number }[]): Map<string, number> {
  return new Map(rows.map((row) => [row.uuid, row.submission_feature_id]));
}

/** Look a natural key up in a remap table, throwing (rather than inserting a dangling FK) when absent. */
export function resolveOrThrow<T>(map: Map<string, T>, key: string, context: string): T {
  const value = map.get(key);

  if (value === undefined) {
    throw new Error(`seed 10: unresolved ${context} key '${key}'`);
  }

  return value;
}

/** Remap anchor rows to live scope ids + feature ids, throwing on any unresolved scope_hash or uuid. */
export function remapAnchorRows(
  anchors: SnapshotAnchor[],
  idMap: Map<string, number>,
  scopeIdByHash: Map<string, string>
): { security_scope_id: string; anchor_submission_feature_id: number }[] {
  return anchors.map((anchor) => ({
    security_scope_id: resolveOrThrow(scopeIdByHash, anchor.scope_hash, 'anchor scope_hash'),
    anchor_submission_feature_id: resolveOrThrow(idMap, anchor.feature_uuid, 'anchor feature')
  }));
}

/**
 * The Group-A tables whose replayed row counts are asserted, mapped to the SQL that counts them.
 *
 * Every table is counted through its join back to `submission_feature` so the count is scoped to the
 * one replayed submission. `property_code` and `property_taxon` are included too: they are not replayed
 * (their per-upload surrogate FKs are not stable natural keys), so the fixture carries them empty and this
 * asserts both at 0 — a guard that fails loudly if a future dump ever reintroduces un-replayable rows.
 */
const COUNT_QUERIES: { table: keyof SnapshotCounts; sql: string }[] = [
  { table: 'features', sql: 'SELECT count(*)::int AS count FROM submission_feature WHERE submission_id = ?' },
  ...(['string', 'number', 'boolean', 'timestamp', 'code', 'taxon', 'geometry', 'feature'] as const).map((suffix) => ({
    table: `property_${suffix}` as keyof SnapshotCounts,
    sql: `SELECT count(*)::int AS count FROM submission_feature_property_${suffix} p
          JOIN submission_feature sf ON sf.submission_feature_id = p.submission_feature_id
          WHERE sf.submission_id = ?`
  })),
  {
    table: 'closure',
    sql: `SELECT count(*)::int AS count FROM submission_feature_closure c
          JOIN submission_feature sf ON sf.submission_feature_id = c.source_submission_feature_id
          WHERE sf.submission_id = ?`
  },
  {
    table: 'feature_feature',
    sql: `SELECT count(*)::int AS count FROM submission_feature_feature e
          JOIN submission_feature sf ON sf.submission_feature_id = e.source_feature_id
          WHERE sf.submission_id = ?`
  },
  {
    table: 'artifact',
    sql: `SELECT count(*)::int AS count FROM submission_feature_artifact a
          JOIN submission_feature sf ON sf.submission_feature_id = a.submission_feature_id
          WHERE sf.submission_id = ?`
  },
  {
    table: 'security',
    sql: `SELECT count(*)::int AS count FROM submission_feature_security s
          JOIN submission_feature sf ON sf.submission_feature_id = s.submission_feature_id
          WHERE sf.submission_id = ? AND s.record_end_date IS NULL`
  },
  {
    table: 'anchors',
    sql: `SELECT count(*)::int AS count FROM security_scope_anchor an
          JOIN submission_feature sf ON sf.submission_feature_id = an.anchor_submission_feature_id
          WHERE sf.submission_id = ?`
  }
];

/**
 * Fail loudly when any replayed table's live row count does not equal the fixture's recorded count.
 *
 * A dump or remap that silently drops rows ships data that looks present but is unsearchable or
 * unsecured; this exact per-table check turns that into a hard stop. It covers every table, including
 * `property_code`/`property_taxon`, which are asserted at 0 (see COUNT_QUERIES).
 */
async function assertReplayedCounts(knex: Knex, fixture: SnapshotFixture, submissionId: number): Promise<void> {
  for (const { table, sql } of COUNT_QUERIES) {
    const result = await knex.raw(sql, [submissionId]);
    const actual: number = result.rows[0].count;
    const expected = fixture.counts[table];

    if (actual !== expected) {
      throw new Error(
        `seed 10: '${fixture.submission.name}' table '${table}' expected ${expected} rows, got ${actual}`
      );
    }
  }
}

/** Split an array into fixed-size chunks for bounded bulk statements. */
function toChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
