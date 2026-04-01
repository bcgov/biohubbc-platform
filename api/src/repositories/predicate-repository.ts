import type { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { TypedPredicate } from '../models/expression-tree';
import { Predicate, PredicateResolveInput, ReadPredicateNodeRow } from '../models/predicate';
import { BaseRepository } from './base-repository';

/**
 * Persistence repository for predicate anchors, payload rows, and runtime-shaped predicate reads.
 *
 * Responsibilities are intentionally split across two access patterns:
 *
 * - Write-side:
 *   - insert predicate anchors by deterministic hash,
 *   - fetch existing anchors by hash when needed for dedup orchestration in service,
 *   - write exactly one typed payload row for newly inserted anchors.
 * - Read-side:
 *   - return predicate leaves already shaped like runtime `ExpressionTreePredicate`
 *     nodes using SQL JSON construction,
 *   - validate that shape in TypeScript via Zod (`ExpressionTreePredicate`).
 *
 * This keeps repositories data-access-focused while avoiding large manual mapper
 * trees in TypeScript.
 */
export class PredicateRepository extends BaseRepository {
  /**
   * Insert a predicate anchor by normalized predicate hash.
   *
   * @param {PredicateResolveInput} payload - Predicate attributes including normalized hash.
   * @return {(Promise<Predicate | undefined>)} Inserted predicate row, or undefined on conflict.
   * @throws {ApiExecuteSQLError} If insert returns an unexpected row count.
   */
  async insertPredicateAnchor(payload: PredicateResolveInput): Promise<Predicate | undefined> {
    const sql = SQL`
      INSERT INTO predicate (
        feature_type_property_id,
        feature_property_type_id,
        predicate_hash
      )
      VALUES (
        ${payload.feature_type_property_id},
        (SELECT fpt.feature_property_type_id FROM feature_property_type fpt WHERE fpt.name = ${payload.feature_property_type_name} AND fpt.record_end_date IS NULL LIMIT 1),
        ${payload.predicate_hash}
      )
      ON CONFLICT (predicate_hash) WHERE record_end_date IS NULL
      DO NOTHING
      RETURNING
        predicate_id,
        feature_type_property_id,
        feature_property_type_id,
        predicate_hash;
    `;
    const response = await this.connection.sql(sql, Predicate);
    const rowCount = response.rowCount ?? 0;

    if (rowCount > 1) {
      throw new ApiExecuteSQLError('Failed to insert predicate anchor', [
        'PredicateRepository->insertPredicateAnchor',
        `rowCount was ${rowCount}, expected 0 or 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch one active predicate anchor by normalized hash.
   *
   * @param {string} predicateHash - Normalized predicate hash.
   * @return {(Promise<Predicate | undefined>)} Matching active predicate row, when present.
   * @throws {ApiExecuteSQLError} If more than one active row is found.
   */
  async getPredicateByHash(predicateHash: string): Promise<Predicate | undefined> {
    const knex = getKnex();
    const query = knex('predicate')
      .select(['predicate_id', 'feature_type_property_id', 'feature_property_type_id', 'predicate_hash'])
      .where('predicate_hash', predicateHash)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, Predicate);
    const rowCount = response.rowCount ?? 0;

    if (rowCount > 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'PredicateRepository->getPredicateByHash',
        `expected rowCount=0|1, actual rowCount=${rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch active predicates by normalized hashes.
   *
   * Deduplicates hash inputs before query execution and returns active anchor
   * rows only (`record_end_date IS NULL`).
   *
   * @param {string[]} predicateHashes - Normalized predicate hashes.
   * @return {Promise<Predicate[]>} Matched active predicate rows.
   */
  async getPredicatesByHashes(predicateHashes: string[]): Promise<Predicate[]> {
    if (predicateHashes.length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = knex('predicate')
      .select(['predicate_id', 'feature_type_property_id', 'feature_property_type_id', 'predicate_hash'])
      .whereIn('predicate_hash', [...new Set(predicateHashes)])
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, Predicate);
    return response.rows;
  }

  private readonly readPayloadCountExpression = `
    (
      (CASE WHEN ps.predicate_id IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN pn.predicate_id IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN pb.predicate_id IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN pt.predicate_id IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN px.predicate_id IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN pg.predicate_id IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN pc.predicate_id IS NULL THEN 0 ELSE 1 END)
    )
  `;

  private readonly readTypedPredicateExpression = `
    CASE
      WHEN ps.predicate_id IS NOT NULL THEN
        jsonb_build_object(
          'type', 'string',
          'operator', ps.operator::text
        ) || CASE
          WHEN ps.operator::text <> 'Exists' THEN jsonb_build_object('value', ps.value)
          ELSE '{}'::jsonb
        END
      WHEN pn.predicate_id IS NOT NULL THEN
        jsonb_build_object(
          'type', 'number',
          'operator', pn.operator::text
        ) || CASE
          WHEN pn.operator::text <> 'Exists' THEN jsonb_build_object('value', pn.value)
          ELSE '{}'::jsonb
        END
      WHEN pb.predicate_id IS NOT NULL THEN
        jsonb_build_object(
          'type', 'boolean',
          'operator', pb.operator::text
        ) || CASE
          WHEN pb.operator::text <> 'Exists' THEN jsonb_build_object('value', pb.value)
          ELSE '{}'::jsonb
        END
      WHEN pt.predicate_id IS NOT NULL THEN
        jsonb_build_object(
          'type', 'timestamp',
          'operator', pt.operator::text
        ) || CASE
          WHEN pt.operator::text <> 'Exists' THEN jsonb_build_object(
            'value',
            jsonb_strip_nulls(
              jsonb_build_object(
                'date_value', pt.date_value,
                'time_value', pt.time_value
              )
            )
          )
          ELSE '{}'::jsonb
        END
      WHEN px.predicate_id IS NOT NULL THEN
        jsonb_build_object(
          'type', 'taxon',
          'operator', px.operator::text
        ) || CASE
          WHEN px.operator::text <> 'Exists' THEN jsonb_build_object('value', px.taxon_id)
          ELSE '{}'::jsonb
        END
      WHEN pg.predicate_id IS NOT NULL THEN
        jsonb_build_object(
          'type', 'geometry',
          'operator', pg.operator::text
        ) || CASE
          WHEN pg.operator::text <> 'Exists' THEN jsonb_build_object('value', ST_AsGeoJSON(pg.value)::jsonb)
          ELSE '{}'::jsonb
        END
      WHEN pc.predicate_id IS NOT NULL THEN
        jsonb_build_object(
          'type', 'code',
          'operator', pc.operator::text
        ) || CASE
          WHEN pc.operator::text <> 'Exists' THEN jsonb_build_object('value', pc.contributor_codeset_code_id)
          ELSE '{}'::jsonb
        END
      ELSE NULL
    END
  `;

  /**
   * Build the read query returning a model-shaped predicate node.
   *
   * Query strategy:
   * 1. base subquery reads anchors + typed payload tables and computes:
   *    - `payload_count` (defensive integrity signal),
   *    - `typed_predicate_json` (runtime-shaped typed predicate payload).
   * 2. outer query emits:
   *    - `predicate_id`
   *    - `payload_count`
   *    - `predicate_node` (`ExpressionTreePredicate`-shaped JSON) only when
   *      `payload_count = 1`.
   *
   * This keeps payload-count logic computed once and avoids sparse-row mapper
   * branches in TypeScript.
   *
   * @param {string[]} predicateIds - Predicate identifiers to fetch.
   * @return {*} Knex query builder for read predicate nodes.
   */
  private buildReadPredicateQuery(predicateIds: string[]) {
    const knex = getKnex();
    const uniquePredicateIds = [...new Set(predicateIds)];
    const baseReadQuery = knex('predicate as p')
      .select([
        'p.predicate_id',
        'p.feature_type_property_id',
        knex.raw(`${this.readPayloadCountExpression} AS payload_count`),
        knex.raw(`${this.readTypedPredicateExpression} AS typed_predicate_json`)
      ])
      .leftJoin('predicate_string as ps', function () {
        this.on('ps.predicate_id', '=', 'p.predicate_id').onNull('ps.record_end_date');
      })
      .leftJoin('predicate_number as pn', function () {
        this.on('pn.predicate_id', '=', 'p.predicate_id').onNull('pn.record_end_date');
      })
      .leftJoin('predicate_boolean as pb', function () {
        this.on('pb.predicate_id', '=', 'p.predicate_id').onNull('pb.record_end_date');
      })
      .leftJoin('predicate_timestamp as pt', function () {
        this.on('pt.predicate_id', '=', 'p.predicate_id').onNull('pt.record_end_date');
      })
      .leftJoin('predicate_taxon as px', function () {
        this.on('px.predicate_id', '=', 'p.predicate_id').onNull('px.record_end_date');
      })
      .leftJoin('predicate_geometry as pg', function () {
        this.on('pg.predicate_id', '=', 'p.predicate_id').onNull('pg.record_end_date');
      })
      .leftJoin('predicate_code as pc', function () {
        this.on('pc.predicate_id', '=', 'p.predicate_id').onNull('pc.record_end_date');
      })
      .whereIn('p.predicate_id', uniquePredicateIds)
      .whereNull('p.record_end_date');

    return knex.from(baseReadQuery.as('base')).select([
      'base.predicate_id',
      'base.payload_count',
      knex.raw(
        `
            CASE
              WHEN base.payload_count = 1 THEN
                jsonb_build_object(
                  'type', 'predicate',
                  'feature_type_property_id', base.feature_type_property_id,
                  'predicate', base.typed_predicate_json
                )
              ELSE NULL
            END AS predicate_node
          `
      )
    ]);
  }

  /**
   * Build an insert query for string predicate payload rows.
   *
   * `Exists` operators intentionally persist `value = null` to keep payload-row
   * shape consistent with other typed payload tables.
   *
   * @param {Knex} knex - Knex instance used to build queries.
   * @param {string} predicateId - Base predicate identifier.
   * @param {Extract<TypedPredicate, { type: 'string' }>} predicate - Typed string payload.
   * @return {Knex.QueryBuilder} Insert query.
   */
  private buildStringPredicateInsert(
    knex: Knex,
    predicateId: string,
    predicate: Extract<TypedPredicate, { type: 'string' }>
  ): Knex.QueryBuilder {
    return knex('predicate_string').insert({
      predicate_id: predicateId,
      operator: predicate.operator,
      value: predicate.operator === 'Exists' ? null : predicate.value ?? null
    });
  }

  /**
   * Build an insert query for number predicate payload rows.
   *
   * `Exists` operators intentionally persist `value = null`.
   *
   * @param {Knex} knex - Knex instance used to build queries.
   * @param {string} predicateId - Base predicate identifier.
   * @param {Extract<TypedPredicate, { type: 'number' }>} predicate - Typed number payload.
   * @return {Knex.QueryBuilder} Insert query.
   */
  private buildNumberPredicateInsert(
    knex: Knex,
    predicateId: string,
    predicate: Extract<TypedPredicate, { type: 'number' }>
  ): Knex.QueryBuilder {
    return knex('predicate_number').insert({
      predicate_id: predicateId,
      operator: predicate.operator,
      value: predicate.operator === 'Exists' ? null : predicate.value ?? null
    });
  }

  /**
   * Build an insert query for boolean predicate payload rows.
   *
   * `Exists` operators intentionally persist `value = null`.
   *
   * @param {Knex} knex - Knex instance used to build queries.
   * @param {string} predicateId - Base predicate identifier.
   * @param {Extract<TypedPredicate, { type: 'boolean' }>} predicate - Typed boolean payload.
   * @return {Knex.QueryBuilder} Insert query.
   */
  private buildBooleanPredicateInsert(
    knex: Knex,
    predicateId: string,
    predicate: Extract<TypedPredicate, { type: 'boolean' }>
  ): Knex.QueryBuilder {
    return knex('predicate_boolean').insert({
      predicate_id: predicateId,
      operator: predicate.operator,
      value: predicate.operator === 'Exists' ? null : predicate.value ?? null
    });
  }

  /**
   * Build an insert query for timestamp predicate payload rows.
   *
   * Timestamp payload stores date/time parts separately. For `Exists`, both
   * components are stored as `null`.
   *
   * @param {Knex} knex - Knex instance used to build queries.
   * @param {string} predicateId - Base predicate identifier.
   * @param {Extract<TypedPredicate, { type: 'timestamp' }>} predicate - Typed timestamp payload.
   * @return {Knex.QueryBuilder} Insert query.
   */
  private buildTimestampPredicateInsert(
    knex: Knex,
    predicateId: string,
    predicate: Extract<TypedPredicate, { type: 'timestamp' }>
  ): Knex.QueryBuilder {
    return knex('predicate_timestamp').insert({
      predicate_id: predicateId,
      operator: predicate.operator,
      date_value: predicate.operator === 'Exists' ? null : predicate.value?.date_value ?? null,
      time_value: predicate.operator === 'Exists' ? null : predicate.value?.time_value ?? null
    });
  }

  /**
   * Build an insert query for taxon predicate payload rows.
   *
   * `Exists` operators intentionally persist `taxon_id = null`.
   *
   * @param {Knex} knex - Knex instance used to build queries.
   * @param {string} predicateId - Base predicate identifier.
   * @param {Extract<TypedPredicate, { type: 'taxon' }>} predicate - Typed taxon payload.
   * @return {Knex.QueryBuilder} Insert query.
   */
  private buildTaxonPredicateInsert(
    knex: Knex,
    predicateId: string,
    predicate: Extract<TypedPredicate, { type: 'taxon' }>
  ): Knex.QueryBuilder {
    return knex('predicate_taxon').insert({
      predicate_id: predicateId,
      operator: predicate.operator,
      taxon_id: predicate.operator === 'Exists' ? null : predicate.value ?? null
    });
  }

  /**
   * Build an insert query for geometry predicate payload rows.
   *
   * Geometry payload is persisted using `ST_GeomFromGeoJSON` for non-`Exists`
   * operators and `null` otherwise.
   *
   * @param {Knex} knex - Knex instance used to build queries.
   * @param {string} predicateId - Base predicate identifier.
   * @param {Extract<TypedPredicate, { type: 'geometry' }>} predicate - Typed geometry payload.
   * @return {Knex.QueryBuilder} Insert query.
   */
  private buildGeometryPredicateInsert(
    knex: Knex,
    predicateId: string,
    predicate: Extract<TypedPredicate, { type: 'geometry' }>
  ): Knex.QueryBuilder {
    const geometryValue = predicate.operator === 'Exists' ? null : predicate.value ?? null;
    return knex('predicate_geometry').insert({
      predicate_id: predicateId,
      operator: predicate.operator,
      value: geometryValue ? knex.raw('ST_GeomFromGeoJSON(?::json)', [JSON.stringify(geometryValue)]) : null
    });
  }

  /**
   * Build an insert query for code predicate payload rows.
   *
   * `Exists` operators intentionally persist code id as `null`.
   *
   * @param {Knex} knex - Knex instance used to build queries.
   * @param {string} predicateId - Base predicate identifier.
   * @param {Extract<TypedPredicate, { type: 'code' }>} predicate - Typed code payload.
   * @return {Knex.QueryBuilder} Insert query.
   */
  private buildCodePredicateInsert(
    knex: Knex,
    predicateId: string,
    predicate: Extract<TypedPredicate, { type: 'code' }>
  ): Knex.QueryBuilder {
    return knex('predicate_code').insert({
      predicate_id: predicateId,
      operator: predicate.operator,
      contributor_codeset_code_id: predicate.operator === 'Exists' ? null : predicate.value ?? null
    });
  }

  /**
   * Insert the typed payload row for a predicate subtype.
   *
   * Exactly one typed payload row should exist for each predicate anchor.
   * Dispatches to subtype-specific insert builders and asserts a single-row
   * insert response.
   *
   * @param {string} predicateId - Base predicate identifier.
   * @param {TypedPredicate} predicate - Typed predicate payload.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If insert does not affect exactly one row.
   */
  async writePredicatePayload(predicateId: string, predicate: TypedPredicate): Promise<void> {
    const knex = getKnex();
    const query = (() => {
      switch (predicate.type) {
        case 'string':
          return this.buildStringPredicateInsert(knex, predicateId, predicate);
        case 'number':
          return this.buildNumberPredicateInsert(knex, predicateId, predicate);
        case 'boolean':
          return this.buildBooleanPredicateInsert(knex, predicateId, predicate);
        case 'timestamp':
          return this.buildTimestampPredicateInsert(knex, predicateId, predicate);
        case 'taxon':
          return this.buildTaxonPredicateInsert(knex, predicateId, predicate);
        case 'geometry':
          return this.buildGeometryPredicateInsert(knex, predicateId, predicate);
        case 'code':
          return this.buildCodePredicateInsert(knex, predicateId, predicate);
      }
    })();

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to write typed predicate payload', [
        'PredicateRepository->writePredicatePayload',
        `rowCount was ${response.rowCount}, expected 1`,
        { predicateId, predicateType: predicate.type }
      ]);
    }
  }

  /**
   * Read one predicate id into the expression-tree predicate shape.
   *
   * This is the single-id convenience wrapper around the read query + parse
   * pipeline.
   *
   * @param {string} predicateId - Predicate identifier.
   * @return {Promise<ReadPredicateNodeRow>} Read predicate row.
   * @throws {ApiNotFoundError} If no active predicate row exists for the id.
   */
  async readPredicateNode(predicateId: string): Promise<ReadPredicateNodeRow> {
    const query = this.buildReadPredicateQuery([predicateId]);
    const response = await this.connection.knex(query, ReadPredicateNodeRow);
    const rows = response.rows;

    if (rows.length === 0) {
      throw new ApiNotFoundError('predicate not found', ['PredicateRepository->readPredicateNode', { predicateId }]);
    }

    return rows[0];
  }

  /**
   * Read multiple predicate ids and preserve caller-provided order.
   *
   * Query results are indexed by `predicate_id`, then mapped in the caller's
   * original id order so higher-level tree reconstruction preserves authored
   * clause ordering.
   *
   * @param {string[]} predicateIds - Predicate identifiers.
   * @return {Promise<ReadPredicateNodeRow[]>} Read predicate rows in input order.
   * @throws {ApiNotFoundError} If any requested predicate id is missing.
   */
  async readPredicateNodes(predicateIds: string[]): Promise<ReadPredicateNodeRow[]> {
    if (predicateIds.length === 0) {
      return [];
    }

    const query = this.buildReadPredicateQuery(predicateIds);
    const response = await this.connection.knex(query, ReadPredicateNodeRow);
    const rows = response.rows;
    const byId = new Map<string, ReadPredicateNodeRow>(rows.map((row) => [row.predicate_id, row]));

    return predicateIds.map((predicateId) => {
      const row = byId.get(predicateId);
      if (!row) {
        throw new ApiNotFoundError('predicate not found', ['PredicateRepository->readPredicateNodes', { predicateId }]);
      }
      return row;
    });
  }
}
