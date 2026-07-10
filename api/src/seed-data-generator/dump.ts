// Run-once api-context tool that serializes the live DB rows of a generated snapshot submission into a
// committed, replay-ready fixture. The fixture — not the generator or the source tar — is the seed's
// source of truth; the `10_*` replay seed reads it to rebuild the submission with fresh ids.
//
// Every row is keyed by a stable natural key (uuid, object_key, scope_hash, or a resolved name), never
// by an identity/serial column, because those are regenerated on every replay and differ across
// environments. It is intentionally NOT wired into any build or request flow.
import SQL from 'sql-template-strings';
import { IDBConnection } from '../database/db';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('seed-data-generator/dump');

/** Recreate-able submission metadata (the volatile submission_id and FK ids are deliberately omitted). */
export interface SnapshotSubmission {
  name: string;
  description: string | null;
  comment: string | null;
}

/**
 * A submission_feature row keyed by its stable uuid.
 *
 * `feature_type_name` is captured instead of feature_type_id because feature-type ids are assigned by
 * migration order and are not stable across environments; the replay re-resolves the name to this DB's
 * id. `parent_uuid` records the self-FK as the parent's uuid so the parent link survives the id rebuild.
 */
export interface SnapshotFeature {
  uuid: string;
  feature_type_name: string;
  parent_uuid: string | null;
  source_id: string | null;
  urn: string | null;
  data: unknown;
  data_byte_size: number | null;
}

/** A scalar property row (string/number/boolean) keyed by the owning feature's uuid + property id. */
export interface SnapshotScalarProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  value: string | number | boolean | null;
}

/**
 * A timestamp property row.
 *
 * submission_feature_property_timestamp was split into separate date_value + time_value columns; there
 * is no single `value` column, so both are captured.
 */
export interface SnapshotTimestampProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  date_value: string | null;
  time_value: string | null;
}

/** A code property row; the real column is contributor_codeset_code_id, not a generic code id. */
export interface SnapshotCodeProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  contributor_codeset_code_id: number;
}

/** A taxon property row referencing an ITIS TSN. */
export interface SnapshotTaxonProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  taxon_id: number;
}

/**
 * A geometry property row.
 *
 * PostGIS binary geometry is emitted as GeoJSON via ST_AsGeoJSON so the fixture is JSON-serializable;
 * the replay re-inserts it through ST_GeomFromGeoJSON.
 */
export interface SnapshotGeometryProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  geojson: unknown;
}

/**
 * A feature-reference property row.
 *
 * Double-keyed: the owning feature's uuid plus the referenced feature's uuid (the live
 * referenced_submission_feature_id resolves to that feature's stable uuid), so both endpoints survive
 * the id rebuild.
 */
export interface SnapshotFeatureProperty {
  feature_uuid: string;
  feature_type_property_id: number;
  referenced_feature_uuid: string;
}

/** A reachability-closure edge with both endpoints resolved to uuids. */
export interface SnapshotClosureEdge {
  source_uuid: string;
  target_uuid: string;
  is_ancestor: boolean;
}

/** A content edge (data.content array) with both endpoints resolved to uuids. */
export interface SnapshotFeatureFeatureEdge {
  source_uuid: string;
  target_uuid: string;
}

/** A feature-to-artifact link keyed by the feature uuid + the artifact's object_key (the remap key). */
export interface SnapshotArtifact {
  feature_uuid: string;
  object_key: string;
}

/**
 * A per-feature security row.
 *
 * The applied security rule is captured by name (resolved from security_rule), never by id: rule ids
 * are assigned by migration order and shift across environments, so the replay re-resolves the name.
 */
export interface SnapshotSecurity {
  feature_uuid: string;
  security_rule_name: string;
}

/**
 * A security-scope anchor row.
 *
 * `scope_hash` (sha256 of the scope URN) is the scope's stable natural key; the global security_scope_id
 * is regenerated each replay, so the anchor is re-bound to the live scope via the hash.
 */
export interface SnapshotAnchor {
  feature_uuid: string;
  scope_hash: string;
}

/**
 * Per-Group-A-table row counts recorded at generation time.
 *
 * This block is the replay seed's source of truth: after replay rebuilds the submission, it asserts
 * each table's live count equals the count here and fails loudly on any shortfall, so an incomplete
 * dump or remap can never silently ship unsearchable/unsecured data.
 */
export interface SnapshotCounts {
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

/** The full uuid-keyed fixture for one snapshot submission. */
export interface SnapshotFixture {
  submission: SnapshotSubmission;
  features: SnapshotFeature[];
  property_string: SnapshotScalarProperty[];
  property_number: SnapshotScalarProperty[];
  property_boolean: SnapshotScalarProperty[];
  property_timestamp: SnapshotTimestampProperty[];
  property_code: SnapshotCodeProperty[];
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

/**
 * Serialize every Group-A table of a generated submission into a uuid-keyed fixture with row counts.
 *
 * Each SELECT is bounded by the submission (its submission_id, or its set of feature ids via the
 * submission_feature FK chain) rather than by table size, so the dump stays bounded as the platform's
 * shared feature tables grow toward hundreds of millions of rows. The whole submission is read into
 * memory once, which is acceptable for run-once tooling that produces a single committed file.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The generated submission to dump.
 * @returns {Promise<SnapshotFixture>} The uuid-keyed fixture plus per-table counts.
 */
export async function dumpSubmission(connection: IDBConnection, submissionId: number): Promise<SnapshotFixture> {
  const submission = await dumpSubmissionMetadata(connection, submissionId);
  const features = await dumpFeatures(connection, submissionId);

  const propertyString = await dumpScalarProperty(connection, submissionId, 'submission_feature_property_string');
  const propertyNumber = await dumpScalarProperty(connection, submissionId, 'submission_feature_property_number');
  const propertyBoolean = await dumpScalarProperty(connection, submissionId, 'submission_feature_property_boolean');
  const propertyTimestamp = await dumpTimestampProperty(connection, submissionId);
  // property_code and property_taxon are intentionally NOT dumped: their FKs (contributor_codeset_code_id
  // and the taxon surrogate PK) are per-upload surrogate ids, not stable natural keys, so the pure-knex
  // replay seed cannot rebuild them. Emitting them empty keeps the fixture honest — it holds only rows the
  // seed actually replays, and the replay seed asserts both counts at 0.
  const propertyCode: SnapshotCodeProperty[] = [];
  const propertyTaxon: SnapshotTaxonProperty[] = [];
  const propertyGeometry = await dumpGeometryProperty(connection, submissionId);
  const propertyFeature = await dumpFeatureProperty(connection, submissionId);

  const closure = await dumpClosure(connection, submissionId);
  const featureFeature = await dumpFeatureFeature(connection, submissionId);
  const artifact = await dumpArtifact(connection, submissionId);
  const security = await dumpSecurity(connection, submissionId);
  const anchors = await dumpAnchors(connection, submissionId);

  const counts: SnapshotCounts = {
    features: features.length,
    property_string: propertyString.length,
    property_number: propertyNumber.length,
    property_boolean: propertyBoolean.length,
    property_timestamp: propertyTimestamp.length,
    property_code: propertyCode.length,
    property_taxon: propertyTaxon.length,
    property_geometry: propertyGeometry.length,
    property_feature: propertyFeature.length,
    closure: closure.length,
    feature_feature: featureFeature.length,
    artifact: artifact.length,
    security: security.length,
    anchors: anchors.length
  };

  defaultLog.info({ label: 'dumpSubmission', message: 'dumped submission', submissionId, counts });

  return {
    submission,
    features,
    property_string: propertyString,
    property_number: propertyNumber,
    property_boolean: propertyBoolean,
    property_timestamp: propertyTimestamp,
    property_code: propertyCode,
    property_taxon: propertyTaxon,
    property_geometry: propertyGeometry,
    property_feature: propertyFeature,
    closure,
    feature_feature: featureFeature,
    artifact,
    security,
    anchors,
    counts
  };
}

/**
 * Read the recreate-able submission metadata.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<SnapshotSubmission>} The submission name/description/comment.
 */
async function dumpSubmissionMetadata(connection: IDBConnection, submissionId: number): Promise<SnapshotSubmission> {
  const response = await connection.sql<SnapshotSubmission>(SQL`
    SELECT name, description, comment
    FROM submission
    WHERE submission_id = ${submissionId};
  `);

  if (response.rowCount !== 1) {
    throw new Error(
      `dumpSubmissionMetadata: expected exactly one submission for id ${submissionId}, found ${response.rowCount}`
    );
  }

  return response.rows[0];
}

/**
 * Read all submission_feature rows, resolving feature-type id to name and the parent self-FK to a uuid.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<SnapshotFeature[]>} One row per feature, uuid-keyed.
 */
async function dumpFeatures(connection: IDBConnection, submissionId: number): Promise<SnapshotFeature[]> {
  const response = await connection.sql<SnapshotFeature>(SQL`
    SELECT
      sf.uuid,
      ft.name AS feature_type_name,
      parent.uuid AS parent_uuid,
      sf.source_id,
      sf.urn,
      sf.data,
      sf.data_byte_size
    FROM submission_feature sf
    JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
    LEFT JOIN submission_feature parent ON parent.submission_feature_id = sf.parent_submission_feature_id
    WHERE sf.submission_id = ${submissionId}
      AND sf.record_end_date IS NULL;
  `);

  return response.rows;
}

/** The names of the three scalar property tables sharing a single `value` column. */
type ScalarPropertyTable =
  | 'submission_feature_property_string'
  | 'submission_feature_property_number'
  | 'submission_feature_property_boolean';

/**
 * Read a scalar property table (string/number/boolean), keyed by the owning feature's uuid.
 *
 * The three scalar tables are structurally identical (one `value` column), so they share one read.
 * The table name is interpolated as a constant from the closed `ScalarPropertyTable` union — it is
 * never user input — so this cannot be a SQL-injection vector.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @param {ScalarPropertyTable} table The scalar property table to read.
 * @returns {Promise<SnapshotScalarProperty[]>} One row per property.
 */
async function dumpScalarProperty(
  connection: IDBConnection,
  submissionId: number,
  table: ScalarPropertyTable
): Promise<SnapshotScalarProperty[]> {
  const statement = SQL`
    SELECT sf.uuid AS feature_uuid, prop.feature_type_property_id, prop.value
  `;
  statement.append(` FROM ${table} prop `);
  statement.append(SQL`
    JOIN submission_feature sf ON sf.submission_feature_id = prop.submission_feature_id
    WHERE sf.submission_id = ${submissionId};
  `);

  const response = await connection.sql<SnapshotScalarProperty>(statement);

  return response.rows;
}

/**
 * Read the timestamp property table, capturing the split date_value + time_value columns.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<SnapshotTimestampProperty[]>} One row per timestamp property.
 */
async function dumpTimestampProperty(
  connection: IDBConnection,
  submissionId: number
): Promise<SnapshotTimestampProperty[]> {
  const response = await connection.sql<SnapshotTimestampProperty>(SQL`
    SELECT
      sf.uuid AS feature_uuid,
      prop.feature_type_property_id,
      prop.date_value,
      prop.time_value
    FROM submission_feature_property_timestamp prop
    JOIN submission_feature sf ON sf.submission_feature_id = prop.submission_feature_id
    WHERE sf.submission_id = ${submissionId};
  `);

  return response.rows;
}

/**
 * Read the geometry property table, emitting each geometry as GeoJSON.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<SnapshotGeometryProperty[]>} One row per geometry property.
 */
async function dumpGeometryProperty(
  connection: IDBConnection,
  submissionId: number
): Promise<SnapshotGeometryProperty[]> {
  const response = await connection.sql<SnapshotGeometryProperty>(SQL`
    SELECT
      sf.uuid AS feature_uuid,
      prop.feature_type_property_id,
      ST_AsGeoJSON(prop.value)::json AS geojson
    FROM submission_feature_property_geometry prop
    JOIN submission_feature sf ON sf.submission_feature_id = prop.submission_feature_id
    WHERE sf.submission_id = ${submissionId};
  `);

  return response.rows;
}

/**
 * Read the feature-reference property table, resolving the referenced feature id to its uuid.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<SnapshotFeatureProperty[]>} One row per feature-reference property.
 */
async function dumpFeatureProperty(
  connection: IDBConnection,
  submissionId: number
): Promise<SnapshotFeatureProperty[]> {
  const response = await connection.sql<SnapshotFeatureProperty>(SQL`
    SELECT
      owner.uuid AS feature_uuid,
      prop.feature_type_property_id,
      referenced.uuid AS referenced_feature_uuid
    FROM submission_feature_property_feature prop
    JOIN submission_feature owner ON owner.submission_feature_id = prop.submission_feature_id
    JOIN submission_feature referenced ON referenced.submission_feature_id = prop.referenced_submission_feature_id
    WHERE owner.submission_id = ${submissionId};
  `);

  return response.rows;
}

/**
 * Read the reachability closure, resolving both edge endpoints to uuids.
 *
 * Bounded by joining both endpoints to submission_feature and filtering the source on submission_id;
 * closure edges never cross submissions, so the source filter captures the whole submission's closure.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<SnapshotClosureEdge[]>} One row per closure edge.
 */
async function dumpClosure(connection: IDBConnection, submissionId: number): Promise<SnapshotClosureEdge[]> {
  const response = await connection.sql<SnapshotClosureEdge>(SQL`
    SELECT
      source.uuid AS source_uuid,
      target.uuid AS target_uuid,
      closure.is_ancestor
    FROM submission_feature_closure closure
    JOIN submission_feature source ON source.submission_feature_id = closure.source_submission_feature_id
    JOIN submission_feature target ON target.submission_feature_id = closure.target_submission_feature_id
    WHERE source.submission_id = ${submissionId};
  `);

  return response.rows;
}

/**
 * Read the content edges (data.content array), resolving both endpoints to uuids.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<SnapshotFeatureFeatureEdge[]>} One row per content edge.
 */
async function dumpFeatureFeature(
  connection: IDBConnection,
  submissionId: number
): Promise<SnapshotFeatureFeatureEdge[]> {
  const response = await connection.sql<SnapshotFeatureFeatureEdge>(SQL`
    SELECT
      source.uuid AS source_uuid,
      target.uuid AS target_uuid
    FROM submission_feature_feature edge
    JOIN submission_feature source ON source.submission_feature_id = edge.source_feature_id
    JOIN submission_feature target ON target.submission_feature_id = edge.target_feature_id
    WHERE source.submission_id = ${submissionId};
  `);

  return response.rows;
}

/**
 * Read the feature-to-artifact links, keyed by the artifact's object_key (the remap key).
 *
 * object_key lives on the artifact table, not on the link row, so artifact is joined to surface the
 * stable key the replay rebinds against (artifact_id is regenerated each replay).
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<SnapshotArtifact[]>} One row per feature-artifact link.
 */
async function dumpArtifact(connection: IDBConnection, submissionId: number): Promise<SnapshotArtifact[]> {
  const response = await connection.sql<SnapshotArtifact>(SQL`
    SELECT
      sf.uuid AS feature_uuid,
      a.object_key
    FROM submission_feature_artifact sfa
    JOIN submission_feature sf ON sf.submission_feature_id = sfa.submission_feature_id
    JOIN artifact a ON a.artifact_id = sfa.artifact_id
    WHERE sf.submission_id = ${submissionId};
  `);

  return response.rows;
}

/**
 * Read the per-feature security rows, resolving the rule id to its name.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<SnapshotSecurity[]>} One row per active security application.
 */
async function dumpSecurity(connection: IDBConnection, submissionId: number): Promise<SnapshotSecurity[]> {
  const response = await connection.sql<SnapshotSecurity>(SQL`
    SELECT
      sf.uuid AS feature_uuid,
      sr.name AS security_rule_name
    FROM submission_feature_security sfs
    JOIN submission_feature sf ON sf.submission_feature_id = sfs.submission_feature_id
    JOIN security_rule sr ON sr.security_rule_id = sfs.security_rule_id
    WHERE sf.submission_id = ${submissionId}
      AND sfs.record_end_date IS NULL;
  `);

  return response.rows;
}

/**
 * Read the security-scope anchors for the submission's features, recording each scope's hash.
 *
 * Anchors reference the global security_scope by id (regenerated each replay); scope_hash is the
 * scope's stable natural key the replay rebinds against, so it is joined in here.
 *
 * @param {IDBConnection} connection Transaction-scoped connection.
 * @param {number} submissionId The submission scope.
 * @returns {Promise<SnapshotAnchor[]>} One row per anchor.
 */
async function dumpAnchors(connection: IDBConnection, submissionId: number): Promise<SnapshotAnchor[]> {
  const response = await connection.sql<SnapshotAnchor>(SQL`
    SELECT
      sf.uuid AS feature_uuid,
      ss.scope_hash
    FROM security_scope_anchor anchor
    JOIN submission_feature sf ON sf.submission_feature_id = anchor.anchor_submission_feature_id
    JOIN security_scope ss ON ss.security_scope_id = anchor.security_scope_id
    WHERE sf.submission_id = ${submissionId};
  `);

  return response.rows;
}
