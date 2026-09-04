import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiBuildSQLError } from '../errors/api-error';
import { InternalTimestampPredicate, InternalTypedPredicate } from '../models/expression-predicate';
import {
  NormalizedExpressionTree,
  NormalizedExpressionTreeClause,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';
import type { LogicalOperator } from '../models/logical-operator';
import type {
  SearchFeatureCursor,
  SearchFeatureQueryOptions,
  SearchFeatureSort
} from '../models/search-feature-pagination';
import { hasCompatiblePredicates } from '../utils/expression-optimization';
import { buildSecurityFilter, isEffectivelySecured, isSubmissionFeatureCurrent } from './sql-fragments';

/**
 * Pure SQL builders that compile an expression tree into Knex
 * subqueries returning matching submission_feature_id values for an anchor
 * feature type.
 *
 * The evaluator starts from closure-eligible anchor features and compiles the
 * expression tree directly into nested SQL AND/OR groups. Every predicate is a
 * correlated EXISTS probe over its typed property table. Same-type evidence
 * must be the anchor row itself; different-type evidence may be connected
 * through `submission_feature_closure` in either direction. The evaluator does
 * not recursively walk content edges.
 *
 * Read-time evaluator shared by the search wrapper (POST /api/search/feature)
 * and the download pipeline (POST /api/download). Both paths consume the same
 * emitted SQL, so a single substrate keeps semantics — including security
 * filtering — identical across both consumers.
 *
 * Inputs are assumed to be validated and optimized before reaching this module.
 * These functions only translate the explicit optimized representation into SQL.
 *
 * Shape parallels `sql-fragments.ts`: stateless module functions that emit
 * knex QueryBuilders without ever executing SQL or holding a connection.
 */

/**
 * Build a Knex subquery that returns submission_feature_id rows matching the
 * given expression tree, scoped to the anchor feature type, with
 * the security filter applied for the given system user — without executing.
 *
 * Used by:
 * - `SearchFeatureRepository.searchFeaturesByExpressionTree(...)` to drive the
 *   hydrated search projection.
 * - The download pipeline to compose the resolved feature set as a SQL
 *   subquery inside a streaming cursor (no JS array round-trip for large ID
 *   sets).
 *
 * @param {string} anchorFeatureType - Route anchor/result feature type
 * @param {NormalizedExpressionTree} expression - Expression tree criteria
 * @param {number | null} systemUserId - Security context (null = anonymous)
 * @param {SearchFeatureQueryOptions} [options] - Optional anchor ordering and pagination
 * @return {Knex.QueryBuilder} Unexecuted subquery returning submission_feature_id rows
 */
export function buildExpressionTreeFeatureIdsSubquery(
  anchorFeatureType: string,
  expression: NormalizedExpressionTree,
  systemUserId: number | null,
  options?: SearchFeatureQueryOptions
): Knex.QueryBuilder {
  const knex = getKnex();
  return buildExpressionTargetIdsQuery(anchorFeatureType, expression, knex, systemUserId, options);
}

/**
 * Build a Knex subquery that returns every closure-eligible submission_feature_id for the given
 * feature type, with the security filter applied for the given user — the broad,
 * no-expression-filter projection used when a policy statement carries no expression
 * link.
 *
 * Counterpart to `buildExpressionTreeFeatureIdsSubquery` for the broad path. The
 * security filter is the only gate against a runaway export when no expression is
 * present, so it must always be composed in.
 *
 * @param {string} featureTypeName - The feature type name to project.
 * @param {number | null} systemUserId - Security context (null = anonymous, only unsecured features).
 * @param {SearchFeatureQueryOptions} [options] - Optional search ordering and page limit.
 * @return {Knex.QueryBuilder} Unexecuted subquery returning submission_feature_id rows.
 */
export function buildBroadFeatureTypeSubquery(
  featureTypeName: string,
  systemUserId: number | null,
  options?: SearchFeatureQueryOptions
): Knex.QueryBuilder {
  const knex = getKnex();
  let query = knex('submission_feature as sf').select('sf.submission_feature_id');

  // A limited search must start from the type/order index. A semi-join lets a bad closure-row
  // estimate drive the plan from every self-loop before applying a sparse feature type. Unpaginated
  // exports retain the set-oriented semi-join because they necessarily consume the complete set.
  if (options?.limit) {
    const featureTypeId = knex('feature_type as ft')
      .select('ft.feature_type_id')
      .where('ft.name', featureTypeName)
      .whereNull('ft.record_end_date');

    query = query.where('sf.feature_type_id', featureTypeId).whereRaw(
      `(
          SELECT true
          FROM submission_feature_closure sfc
          WHERE sfc.source_submission_feature_id = sf.submission_feature_id
            AND sfc.target_submission_feature_id = sf.submission_feature_id
          LIMIT 1
        ) IS TRUE`
    );
  } else {
    query = query
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .where('ft.name', featureTypeName)
      .whereExists(
        knex('submission_feature_closure as sfc')
          .select(knex.raw('1'))
          .whereRaw('sfc.source_submission_feature_id = sf.submission_feature_id')
          .whereRaw('sfc.target_submission_feature_id = sf.submission_feature_id')
      );
  }

  const securityFilter = buildSecurityFilter(knex, systemUserId, 'sf.submission_feature_id');
  if (securityFilter) {
    query = query.whereRaw(securityFilter);
  }

  applySearchQueryOptions(query, 'sf', options);

  return query;
}

/**
 * Builds the current feature IDs used by the broad estimate path.
 *
 * Unlike the paginated broad search, this query resolves security as two small sets and removes
 * denied IDs once instead of evaluating the canonical access predicate for every matching feature.
 * It deliberately omits closure self-loop readiness, matching the expression estimate's tolerance
 * for an asynchronously rebuilding closure while avoiding millions of point probes.
 *
 * @param {string} featureTypeName - Feature type to count.
 * @param {number | null} systemUserId - Security context (null = anonymous).
 * @return {Knex.QueryBuilder} Unexecuted query returning visible feature IDs.
 */
export function buildBroadFeatureTypeCountSubquery(
  featureTypeName: string,
  systemUserId: number | null
): Knex.QueryBuilder {
  const knex = getKnex();
  const denied = buildDeniedEvidenceFeatureIdsQuery(knex, systemUserId);

  return knex
    .with('denied', denied)
    .from('submission_feature as sf')
    .select('sf.submission_feature_id')
    .join('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id')
    .where('ft.name', featureTypeName)
    .whereNull('ft.record_end_date')
    .whereRaw(isSubmissionFeatureCurrent('sf'))
    .whereNotExists(
      knex('denied').select(knex.raw('1')).whereRaw('denied.submission_feature_id = sf.submission_feature_id')
    );
}

/**
 * Build a Knex subquery that returns submission_feature_id rows matching the given
 * expression tree, scoped to the anchor feature type, WITHOUT any security/access filtering.
 *
 * This is the expression-matched candidate set *before* the caller access filter is applied.
 * It exists solely to detect whether a search matched secured features the caller cannot see
 * (`has_more_secured_features`) — it must never be used to return feature rows to a caller,
 * because it does not exclude inaccessible secured features.
 *
 * Routes through the same `buildExpressionTargetIdsQuery` substrate as the filtered variant, but
 * passes `systemUserId = undefined` so `buildSecurityFilter` returns `null` at every layer (both
 * the evidence-level and target-level filters), leaving the candidate set unfiltered.
 *
 * @param {string} anchorFeatureType - Route anchor/result feature type
 * @param {NormalizedExpressionTree} expression - Expression tree criteria
 * @return {Knex.QueryBuilder} Unexecuted subquery returning submission_feature_id rows, no security filter applied
 */
export function buildUnfilteredExpressionTreeFeatureIdsSubquery(
  anchorFeatureType: string,
  expression: NormalizedExpressionTree
): Knex.QueryBuilder {
  const knex = getKnex();
  // systemUserId omitted → buildSecurityFilter returns null at every layer → no access filtering.
  return buildExpressionTargetIdsQuery(anchorFeatureType, expression, knex);
}

/**
 * Builds the exact anchor-feature set for an expression tree.
 *
 * This count-oriented projection starts from indexed typed-property rows, maps each predicate's
 * evidence through closure to the requested anchor type, then combines those anchor ID sets using
 * the expression's AND/OR operators. Starting from evidence avoids evaluating the expression once
 * for every possible anchor while still counting the same feature type returned by search.
 *
 * @param {NormalizedExpressionTree} expression - Expression tree criteria.
 * @param {number | null} systemUserId - Security context (null = anonymous).
 * @return {Knex.QueryBuilder} Unexecuted query returning unique matching anchor IDs.
 */
export function buildExpressionTreeCountFeatureIdsSubquery(
  anchorFeatureType: string,
  expression: NormalizedExpressionTree,
  systemUserId: number | null
): Knex.QueryBuilder {
  const knex = getKnex();
  const denied = buildDeniedEvidenceFeatureIdsQuery(knex, systemUserId);
  const matchingAnchors = buildCountClauseAnchorIdsQuery(expression, anchorFeatureType, knex);

  return knex
    .with('denied', denied)
    .from(matchingAnchors.as('matching_anchors'))
    .select('matching_anchors.submission_feature_id')
    .whereRaw(buildExpressionAvailability(expression, knex))
    .whereNotIn('matching_anchors.submission_feature_id', knex('denied').select('denied.submission_feature_id'));
}

/**
 * Stubbable dependency surface. Production callers route through this bag so
 * tests can replace individual builders with sinon stubs (ESM exports cannot
 * be reassigned directly).
 */
export const dependencies = {
  buildExpressionTreeFeatureIdsSubquery,
  buildBroadFeatureTypeSubquery,
  buildBroadFeatureTypeCountSubquery,
  buildUnfilteredExpressionTreeFeatureIdsSubquery,
  buildExpressionTreeCountFeatureIdsSubquery
};

/**
 * Recursively builds the anchor IDs matching one expression clause.
 *
 * Predicates and compatible predicate expressions use evidence-first queries. Other expressions combine complete
 * child anchor sets with SQL intersection or union according to their logical operator.
 *
 * @example
 * `AND(Count > 7, Name = 'elk')` builds the intersection of the independently resolved Count and Name anchor sets.
 * `OR(Name = 'elk', Name = 'deer')` is compatible and instead builds one evidence query with an `IN` filter.
 *
 * @param {NormalizedExpressionTreeClause} clause - Predicate or expression to evaluate.
 * @param {string} anchorFeatureType - Feature type returned by the count query.
 * @param {Knex} knex - Knex instance used to build the query.
 * @return {Knex.QueryBuilder} Query returning matching anchor IDs.
 */
function buildCountClauseAnchorIdsQuery(
  clause: NormalizedExpressionTreeClause,
  anchorFeatureType: string,
  knex: Knex
): Knex.QueryBuilder {
  if (clause.type === 'predicate') {
    return buildPredicateAnchorIdsQuery(clause, anchorFeatureType, knex);
  }

  if (hasCompatiblePredicates(clause)) {
    return isAndEqualityExpression(clause)
      ? buildAndEqualityAnchorIdsQuery(clause, anchorFeatureType, knex)
      : buildPredicateAnchorIdsQuery(clause, anchorFeatureType, knex);
  }

  const [firstClause, ...remainingClauses] = clause.clauses.map((childClause, index) => {
    const alias = `count_clause_${index}`;

    return knex
      .from(buildCountClauseAnchorIdsQuery(childClause, anchorFeatureType, knex).as(alias))
      .select(`${alias}.submission_feature_id`);
  });

  return clause.operator === 'AND'
    ? firstClause.intersect(remainingClauses, true)
    : firstClause.union(remainingClauses, true);
}

/**
 * Maps one indexed predicate evidence set to closure-eligible anchors of the requested type.
 *
 * @example
 * For a `Survey.name = 'wetland'` predicate with `SampleSite` as the requested anchor type, matching Survey evidence is
 * projected through closure to related SampleSite anchors. A matching SampleSite property row is returned directly.
 * Anchors and evidence without closure self-loops are excluded as inactive or ineligible.
 *
 * @param {NormalizedExpressionTreeClause} evidence - Predicate or compatible same-property expression.
 * @param {string} anchorFeatureType - Feature type returned by the count query.
 * @param {Knex} knex - Knex instance used to build the query.
 * @return {Knex.QueryBuilder} Query returning matching anchor IDs.
 */
function buildPredicateAnchorIdsQuery(
  evidence: NormalizedExpressionTreeClause,
  anchorFeatureType: string,
  knex: Knex
): Knex.QueryBuilder {
  const predicates = getEvidencePredicates(evidence);
  const property = predicates[0];
  const operator = evidence.type === 'expression' ? evidence.operator : 'AND';
  const { tableName } = getPredicateTableConfig(property.internal_predicate);
  const anchorFeatureTypeId = () =>
    knex('feature_type as count_ft')
      .select('count_ft.feature_type_id')
      .where('count_ft.name', anchorFeatureType)
      .whereNull('count_ft.record_end_date');
  const closureSelfIsAvailable = (closureAlias: string, submissionFeatureId: string) =>
    knex.raw(`(
      SELECT true
      FROM submission_feature_closure ${closureAlias}
      WHERE ${closureAlias}.source_submission_feature_id = ${submissionFeatureId}
        AND ${closureAlias}.target_submission_feature_id = ${submissionFeatureId}
      LIMIT 1
    ) IS TRUE`);
  const buildDirectEvidence = (anchorId: string) =>
    applyEvidenceFilters(
      knex(`${tableName} as p`)
        .select(knex.raw('1'))
        .whereRaw(`p.submission_feature_id = ${anchorId}`)
        .where(
          'p.feature_type_property_id',
          buildPredicateFeatureTypePropertyIdsQuery(property, knex).where('ftp.feature_type_id', anchorFeatureTypeId())
        ),
      predicates,
      knex,
      operator
    );

  // The property-assignment trigger guarantees that a property's feature type matches its feature.
  // Resolving the anchor's concrete property id therefore establishes the direct feature type without
  // probing submission_feature once per match; the closure self join remains the current-state gate.
  const directEvidence = applyEvidenceFilters(
    knex(`${tableName} as p`)
      .select('p.submission_feature_id')
      .distinctOn('p.submission_feature_id')
      .join('submission_feature_closure as count_direct_self', function () {
        this.on('count_direct_self.source_submission_feature_id', '=', 'p.submission_feature_id');
      })
      .whereRaw(
        '(count_direct_self.source_submission_feature_id = count_direct_self.target_submission_feature_id) IS TRUE'
      )
      .where(
        'p.feature_type_property_id',
        buildPredicateFeatureTypePropertyIdsQuery(property, knex).where('ftp.feature_type_id', anchorFeatureTypeId())
      )
      .orderBy('p.submission_feature_id'),
    predicates,
    knex,
    operator
  );
  const direct = knex.from(directEvidence.as('count_direct')).select('count_direct.submission_feature_id');

  const buildRelated = (
    closureAlias: string,
    anchorColumn: 'source_submission_feature_id' | 'target_submission_feature_id',
    evidenceColumn: 'source_submission_feature_id' | 'target_submission_feature_id'
  ) => {
    const relatedPropertyRows = applyEvidenceFilters(
      knex(`${tableName} as p`)
        .select('p.submission_feature_id')
        .whereRaw('p.feature_type_property_id = count_related_ftp.feature_type_property_id'),
      predicates,
      knex,
      operator
    ).offset(knex.raw('0') as unknown as number);
    const relatedEvidence = knex
      .from(
        buildPredicateFeatureTypePropertyIdsQuery(property, knex)
          .whereNot('ftp.feature_type_id', anchorFeatureTypeId())
          .as('count_related_ftp')
      )
      .select('count_property_match.submission_feature_id')
      .joinRaw('JOIN LATERAL (?) AS count_property_match ON true', [relatedPropertyRows])
      .offset(knex.raw('0') as unknown as number);
    const relatedAnchors = knex(`submission_feature_closure as ${closureAlias}`)
      .select({ submission_feature_id: `${closureAlias}.${anchorColumn}` })
      .join(
        'submission_feature as count_anchor',
        'count_anchor.submission_feature_id',
        `${closureAlias}.${anchorColumn}`
      )
      .whereRaw(`${closureAlias}.${evidenceColumn} = count_property_evidence.submission_feature_id`)
      .where('count_anchor.feature_type_id', anchorFeatureTypeId())
      .whereRaw(closureSelfIsAvailable('count_anchor_self', 'count_anchor.submission_feature_id'))
      .offset(knex.raw('0') as unknown as number);

    // The lateral property probe resolves each concrete non-anchor property independently, while
    // the lateral closure probe preserves evidence-first traversal. OFFSET 0 prevents PostgreSQL
    // from flattening either boundary, including the dominant anchor property in its cardinality
    // estimate, and scanning every anchor twice for a sparse related-evidence set.
    return knex
      .from(relatedEvidence.as('count_property_evidence'))
      .distinct('count_related_anchor.submission_feature_id')
      .joinRaw('JOIN LATERAL (?) AS count_related_anchor ON true', [relatedAnchors])
      .whereRaw(closureSelfIsAvailable('count_evidence_self', 'count_property_evidence.submission_feature_id'))
      .whereNotIn(
        'count_property_evidence.submission_feature_id',
        knex('denied').select('denied.submission_feature_id')
      );
  };

  const related = buildRelated(
    'count_closure_forward',
    'source_submission_feature_id',
    'target_submission_feature_id'
  ).union(
    [buildRelated('count_closure_reverse', 'target_submission_feature_id', 'source_submission_feature_id')],
    true
  );
  const relatedOnly = knex
    .from(related.as('count_related'))
    .select('count_related.submission_feature_id')
    .whereNotExists(buildDirectEvidence('count_related.submission_feature_id'));

  // Direct and related evidence can resolve to the same anchor. Excluding direct matches from the
  // comparatively sparse related set lets the large direct set stream through UNION ALL without a
  // global sort/hash solely for deduplication.
  return direct.unionAll([relatedOnly], true);
}

/**
 * Maps one AND expression to anchors and requires every requested value.
 *
 * Property rows are filtered once, projected through the same direct/forward/reverse
 * closure rules as ordinary predicates, and grouped only after evidence has been
 * mapped to its result anchor. Distinct evidence rows and distinct related features
 * may therefore jointly satisfy the expression.
 *
 * @example
 * For `Count = 77 AND Count = 100`, an anchor with values `[77, 100]` matches, as does an anchor related to two visible
 * evidence features contributing 77 and 100 separately. An anchor with only 77 does not match. Aggregation occurs after
 * evidence-to-anchor projection and requires the number of distinct matched values to equal the requested value count.
 *
 * @param {NormalizedExpressionTree} expression - AND expression containing same-property equality predicates.
 * @param {string} anchorFeatureType - Feature type returned by the count query.
 * @param {Knex} knex - Knex instance used to build the query.
 * @return {Knex.QueryBuilder} Query returning anchors that matched every equality value.
 */
function buildAndEqualityAnchorIdsQuery(
  expression: NormalizedExpressionTree,
  anchorFeatureType: string,
  knex: Knex
): Knex.QueryBuilder {
  const predicates = getEvidencePredicates(expression);
  const property = predicates[0];
  const { tableName, valueColumn } = getPredicateTableConfig(property.internal_predicate);
  const values = getScalarPredicateValues(predicates);
  const anchorFeatureTypeId = () =>
    knex('feature_type as grouped_count_ft')
      .select('grouped_count_ft.feature_type_id')
      .where('grouped_count_ft.name', anchorFeatureType)
      .whereNull('grouped_count_ft.record_end_date');

  const directRows = applyPropertyReferenceLifecycleFilters(
    knex(`${tableName} as p`)
      .select({ submission_feature_id: 'p.submission_feature_id', matched_value: valueColumn })
      .join('submission_feature_closure as grouped_direct_self', function () {
        this.on('grouped_direct_self.source_submission_feature_id', '=', 'p.submission_feature_id').andOn(
          'grouped_direct_self.target_submission_feature_id',
          '=',
          'p.submission_feature_id'
        );
      })
      .whereIn(
        'p.feature_type_property_id',
        buildPredicateFeatureTypePropertyIdsQuery(property, knex).where('ftp.feature_type_id', anchorFeatureTypeId())
      )
      .whereIn(valueColumn, values),
    property.internal_predicate
  );

  /**
   * Maps related equality evidence to count-query anchors in one closure direction.
   *
   * @param {string} closureAlias - Unique alias for the closure relation.
   * @param {'source_submission_feature_id' | 'target_submission_feature_id'} anchorColumn - Closure column containing the anchor ID.
   * @param {'source_submission_feature_id' | 'target_submission_feature_id'} evidenceColumn - Closure column containing the evidence ID.
   * @return {Knex.QueryBuilder} Query returning anchor IDs and their matched equality values.
   */
  const buildRelatedRows = (
    closureAlias: string,
    anchorColumn: 'source_submission_feature_id' | 'target_submission_feature_id',
    evidenceColumn: 'source_submission_feature_id' | 'target_submission_feature_id'
  ) =>
    applyPropertyReferenceLifecycleFilters(
      knex(`${tableName} as p`)
        .select({ submission_feature_id: `${closureAlias}.${anchorColumn}`, matched_value: valueColumn })
        .join(
          `submission_feature_closure as ${closureAlias}`,
          `${closureAlias}.${evidenceColumn}`,
          'p.submission_feature_id'
        )
        .join(
          'submission_feature as grouped_anchor',
          'grouped_anchor.submission_feature_id',
          `${closureAlias}.${anchorColumn}`
        )
        .where('grouped_anchor.feature_type_id', anchorFeatureTypeId())
        .whereIn(
          'p.feature_type_property_id',
          buildPredicateFeatureTypePropertyIdsQuery(property, knex).whereNot(
            'ftp.feature_type_id',
            anchorFeatureTypeId()
          )
        )
        .whereIn(valueColumn, values)
        .whereExists(
          knex('submission_feature_closure as grouped_evidence_self')
            .select(knex.raw('1'))
            .whereRaw('grouped_evidence_self.source_submission_feature_id = p.submission_feature_id')
            .whereRaw('grouped_evidence_self.target_submission_feature_id = p.submission_feature_id')
        )
        .whereExists(
          knex('submission_feature_closure as grouped_anchor_self')
            .select(knex.raw('1'))
            .whereRaw('grouped_anchor_self.source_submission_feature_id = grouped_anchor.submission_feature_id')
            .whereRaw('grouped_anchor_self.target_submission_feature_id = grouped_anchor.submission_feature_id')
        )
        .whereNotIn('p.submission_feature_id', knex('denied').select('denied.submission_feature_id')),
      property.internal_predicate
    );

  const mappedEvidence = directRows.unionAll(
    [
      buildRelatedRows('grouped_count_forward', 'source_submission_feature_id', 'target_submission_feature_id'),
      buildRelatedRows('grouped_count_reverse', 'target_submission_feature_id', 'source_submission_feature_id')
    ],
    true
  );

  return knex
    .from(mappedEvidence.as('grouped_evidence'))
    .select('grouped_evidence.submission_feature_id')
    .groupBy('grouped_evidence.submission_feature_id')
    .havingRaw('count(DISTINCT grouped_evidence.matched_value) = ?', [values.length]);
}

/**
 * Builds the secured evidence IDs that the caller cannot access.
 *
 * Count estimates deliberately expand from the sparse active-security and user-scope sets rather
 * than applying the result-path security predicate to every evidence row. The result path remains
 * authoritative and fail-closed; this estimate omits closure self-loop eligibility so historical or
 * not-yet-closed evidence may make the displayed approximate total high.
 */
function buildDeniedEvidenceFeatureIdsQuery(knex: Knex, systemUserId: number | null): Knex.QueryBuilder {
  const secured = buildSecuredFeatureIdsQuery(knex);

  if (systemUserId === null) {
    return secured;
  }

  const granted = buildGrantedFeatureIdsQuery(knex, systemUserId);

  return secured.except(granted);
}

/** Builds feature IDs affected by currently enforcing security assignments. */
function buildSecuredFeatureIdsQuery(knex: Knex): Knex.QueryBuilder {
  return knex('submission_feature_security as sfs')
    .distinct({ submission_feature_id: 'security_closure.source_submission_feature_id' })
    .join(
      'submission_feature_closure as security_closure',
      'security_closure.target_submission_feature_id',
      'sfs.submission_feature_id'
    )
    .where('security_closure.is_ancestor', true)
    .where('sfs.status', 'active')
    .whereRaw('sfs.record_effective_date <= now()')
    .where((activeSecurity) => {
      activeSecurity.whereNull('sfs.record_end_date').orWhereRaw('now() < sfs.record_end_date');
    });
}

/**
 * Builds feature IDs granted through the caller's active teams and scope anchors.
 *
 * Starts from the selective user/team side, resolves the caller's reusable scopes and validated
 * anchors, then expands those anchors down through the ancestry closure. Anchor validation mirrors
 * the authoritative result-path checks so stale derived anchors cannot grant estimated access.
 */
function buildGrantedFeatureIdsQuery(knex: Knex, systemUserId: number): Knex.QueryBuilder {
  return knex('team_member as tm')
    .distinct({ submission_feature_id: 'access_closure.source_submission_feature_id' })
    .join('team as t', 't.team_id', 'tm.team_id')
    .join('team_security_scope as tss', 'tss.team_id', 'tm.team_id')
    .join('security_scope as ss', 'ss.security_scope_id', 'tss.security_scope_id')
    .join('security_scope_anchor as ssa', 'ssa.security_scope_id', 'ss.security_scope_id')
    .join('submission_feature as anchor_sf', 'anchor_sf.submission_feature_id', 'ssa.anchor_submission_feature_id')
    .join('feature_type as anchor_ft', 'anchor_ft.feature_type_id', 'anchor_sf.feature_type_id')
    .join('submission_feature_closure as access_closure', (join) => {
      join
        .on('access_closure.target_submission_feature_id', '=', 'ssa.anchor_submission_feature_id')
        .andOn('access_closure.is_ancestor', '=', knex.raw('true'));
    })
    .where('tm.system_user_id', systemUserId)
    .whereNull('tm.record_end_date')
    .whereNull('t.record_end_date')
    .whereRaw(isSubmissionFeatureCurrent('anchor_sf'))
    .whereExists(
      knex('submission_feature_closure as anchor_self')
        .select(knex.raw('1'))
        .whereRaw('anchor_self.source_submission_feature_id = anchor_sf.submission_feature_id')
        .whereRaw('anchor_self.target_submission_feature_id = anchor_sf.submission_feature_id')
    )
    .whereRaw(isEffectivelySecured('anchor_sf.submission_feature_id'))
    .whereRaw(`(ss.urn_submission_id = anchor_sf.submission_id::text OR ss.urn_submission_id = '*')`)
    .whereRaw(`(ss.urn_feature_type = anchor_ft.name OR ss.urn_feature_type = '*')`)
    .whereRaw(`(ss.urn_feature_id = anchor_sf.submission_feature_id::text OR ss.urn_feature_id = '*')`);
}

/**
 * Builds the single anchor-feature query used for every expression shape.
 *
 * Keeping the anchor relation outside the expression lets PostgreSQL apply the
 * feature-type and ordering indexes once. The recursive compiler below adds
 * nested AND/OR expressions without materializing and deduplicating a full
 * target-id set for every leaf.
 *
 * @example
 * Input: anchor type `species_observation`, expression `Count > 7 AND Count < 9`.
 * Output: a query scanning eligible species-observation anchors once and attaching one correlated numeric-evidence
 * probe whose property row must satisfy both bounds.
 *
 * @param {string} anchorFeatureType - Feature type name that result IDs must belong to.
 * @param {NormalizedExpressionTreeClause} clause - Predicate or expression clause.
 * @param {Knex} knex - Knex instance used to build the subquery.
 * @param {number | null} [systemUserId] - Security context (null = anonymous).
 * @return {Knex.QueryBuilder} Unexecuted subquery returning target submission_feature_id rows.
 */
function buildExpressionTargetIdsQuery(
  anchorFeatureType: string,
  clause: NormalizedExpressionTreeClause,
  knex: Knex,
  systemUserId?: number | null,
  options?: SearchFeatureQueryOptions
): Knex.QueryBuilder {
  // A scalar LIMIT probe is deliberate here. PostgreSQL may decorrelate a regular EXISTS into a
  // closure-first semi-join, scanning every self-loop before the outer page LIMIT.
  const query = knex('submission_feature as anchor_sf')
    .select('anchor_sf.submission_feature_id')
    .where(
      'anchor_sf.feature_type_id',
      knex('feature_type as anchor_ft')
        .select('anchor_ft.feature_type_id')
        .where('anchor_ft.name', anchorFeatureType)
        .whereNull('anchor_ft.record_end_date')
    ).whereRaw(`(
      SELECT true
      FROM submission_feature_closure anchor_self
      WHERE anchor_self.source_submission_feature_id = anchor_sf.submission_feature_id
        AND anchor_self.target_submission_feature_id = anchor_sf.submission_feature_id
      LIMIT 1
    ) IS TRUE`);

  // Resolve impossible expressions once before probing every anchor. This guard is deliberately
  // uncorrelated and mirrors only the expression's boolean shape: every actual match requires the
  // corresponding typed evidence to exist somewhere. It does not project anchors or apply access
  // filtering, so it can only short-circuit an empty evidence set and cannot remove a valid result.
  query.whereRaw(buildExpressionAvailability(clause, knex));

  applyExpressionClause(query, clause, knex, systemUserId);

  const anchorSecurityFilter = buildSecurityFilter(knex, systemUserId, 'anchor_sf.submission_feature_id');
  if (anchorSecurityFilter) {
    query.whereRaw(anchorSecurityFilter);
  }

  applySearchQueryOptions(query, 'anchor_sf', options);

  return query;
}

/**
 * Builds an uncorrelated expression that verifies the typed evidence required by a clause exists.
 *
 * Predicate probes start from the indexed property table and retain the expression tree's AND/OR
 * structure. Scalar LIMIT probes prevent PostgreSQL from turning closure readiness into a scan of
 * the complete closure table. Security remains on the authoritative correlated expression below;
 * this guard only proves that an empty raw evidence set makes the expression impossible.
 *
 * @example
 * `AND(A, B)` becomes `available(A) AND available(B)`, while `OR(A, B)` becomes
 * `available(A) OR available(B)`. This is only an early impossibility check; authoritative security and relationship
 * evaluation still occurs in the correlated expression query.
 *
 * @param {NormalizedExpressionTreeClause} clause - Predicate or expression whose evidence must exist.
 * @param {Knex} knex - Knex instance used to build the availability expression.
 * @return {Knex.Raw} Boolean SQL expression that is false when required evidence is unavailable.
 */
function buildExpressionAvailability(clause: NormalizedExpressionTreeClause, knex: Knex): Knex.Raw {
  if (clause.type === 'predicate' || hasCompatiblePredicates(clause)) {
    return buildEvidenceAvailability(clause, knex);
  }

  const operator = clause.operator === 'AND' ? ' AND ' : ' OR ';
  const children = clause.clauses.map((childClause) => buildExpressionAvailability(childClause, knex));

  return knex.raw(`(${children.map(() => '?').join(operator)})`, children);
}

/**
 * Builds the uncorrelated availability probe for predicates that must match one property row.
 *
 * @param {NormalizedExpressionTreeClause} evidence - Predicate or compatible same-property expression.
 * @param {Knex} knex - Knex instance used to build the probe.
 * @return {Knex.Raw} Boolean scalar-subquery expression.
 */
function buildEvidenceAvailability(evidence: NormalizedExpressionTreeClause, knex: Knex): Knex.Raw {
  const predicates = getEvidencePredicates(evidence);
  const property = predicates[0];
  const { tableName, valueColumn } = getPredicateTableConfig(property.internal_predicate);

  if (isAndEqualityExpression(evidence)) {
    const values = getScalarPredicateValues(predicates);
    const query = knex(`${tableName} as p`)
      .select(knex.raw('true'))
      .whereIn('p.feature_type_property_id', buildPredicateFeatureTypePropertyIdsQuery(property, knex))
      .whereIn(valueColumn, values)
      .whereRaw(
        `(
          SELECT true
          FROM submission_feature_closure evidence_available_self
          WHERE evidence_available_self.source_submission_feature_id = p.submission_feature_id
            AND evidence_available_self.target_submission_feature_id = p.submission_feature_id
          LIMIT 1
        ) IS TRUE`
      )
      .havingRaw(`count(DISTINCT ${valueColumn}) = ?`, [values.length])
      .limit(1);

    return knex.raw('(?) IS TRUE', [query]);
  }

  const query = applyEvidenceFilters(
    knex(`${tableName} as p`)
      .select(knex.raw('true'))
      .whereIn('p.feature_type_property_id', buildPredicateFeatureTypePropertyIdsQuery(property, knex))
      .whereRaw(
        `(
          SELECT true
          FROM submission_feature_closure evidence_available_self
          WHERE evidence_available_self.source_submission_feature_id = p.submission_feature_id
            AND evidence_available_self.target_submission_feature_id = p.submission_feature_id
          LIMIT 1
        ) IS TRUE`
      )
      .limit(1),
    predicates,
    knex,
    evidence.type === 'expression' ? evidence.operator : 'AND'
  );

  return knex.raw('(?) IS TRUE', [query]);
}

/**
 * Returns the opposite SQL sort direction.
 *
 * @example
 * `invertOrder('asc')` returns `'desc'`; `invertOrder('desc')` returns `'asc'`.
 *
 * @param {'asc' | 'desc'} order - Sort direction to reverse.
 * @return {'asc' | 'desc'} Opposite sort direction.
 */
const invertOrder = (order: 'asc' | 'desc'): 'asc' | 'desc' => (order === 'asc' ? 'desc' : 'asc');

/**
 * Applies stable keyset ordering, an optional cursor boundary, and an optional page limit.
 *
 * @example
 * `{ sort: 'create_date', order: 'desc', boundary: nextCursor, limit: 25 }` applies a descending tuple boundary on
 * `(create_date, submission_feature_id)`, orders by both columns, and limits the query to 25 rows. A previous-page
 * boundary reverses traversal so the adjacent rows can be fetched efficiently; the caller restores display order.
 *
 * @param {Knex.QueryBuilder} query - Anchor query to paginate.
 * @param {string} tableAlias - Alias qualifying the sortable anchor columns.
 * @param {SearchFeatureQueryOptions} [options] - Validated ordering, cursor boundary, and page limit.
 * @return {void}
 */
function applySearchQueryOptions(
  query: Knex.QueryBuilder,
  tableAlias: string,
  options?: SearchFeatureQueryOptions
): void {
  if (!options) {
    return;
  }

  const isPreviousPage = options.boundary?.direction === 'previous';
  const traversalOrder = isPreviousPage ? invertOrder(options.order) : options.order;
  const resultIdOrder = options.sort === 'create_date' ? options.order : 'asc';
  const idTraversalOrder = isPreviousPage ? invertOrder(resultIdOrder) : resultIdOrder;

  if (options.boundary) {
    applySearchCursor(query, tableAlias, options.sort, traversalOrder, idTraversalOrder, options.boundary);
  }

  query.orderBy(`${tableAlias}.${options.sort}`, traversalOrder);

  if (options.sort !== 'submission_feature_id') {
    query.orderBy(`${tableAlias}.submission_feature_id`, idTraversalOrder);
  }

  if (options.limit) {
    query.limit(options.limit);
  }
}

/**
 * Applies the exclusive keyset boundary represented by a search cursor.
 *
 * @example
 * ID sort ascending with cursor ID 100 adds `submission_feature_id > 100`.
 * Creation-date sort descending adds `(create_date, submission_feature_id) < (?, ?)` so equal timestamps resume from
 * the unique feature-ID tie-breaker without gaps or duplicates.
 *
 * @param {Knex.QueryBuilder} query - Query receiving the cursor predicate.
 * @param {string} tableAlias - Alias qualifying the cursor columns.
 * @param {SearchFeatureSort} sort - Active sort column.
 * @param {'asc' | 'desc'} order - Traversal direction for the primary sort column.
 * @param {'asc' | 'desc'} idOrder - Traversal direction for the feature-ID tie-breaker.
 * @param {SearchFeatureCursor} cursor - Decoded exclusive boundary.
 * @return {void}
 */
function applySearchCursor(
  query: Knex.QueryBuilder,
  tableAlias: string,
  sort: SearchFeatureSort,
  order: 'asc' | 'desc',
  idOrder: 'asc' | 'desc',
  cursor: SearchFeatureCursor
): void {
  const idOperator = idOrder === 'asc' ? '>' : '<';

  if (sort === 'submission_feature_id') {
    query.whereRaw(`?? ${idOperator} ?`, [`${tableAlias}.submission_feature_id`, cursor.submission_feature_id]);
    return;
  }

  const sortOperator = order === 'asc' ? '>' : '<';
  query.whereRaw(`(??, ??) ${sortOperator} (?, ?)`, [
    `${tableAlias}.create_date`,
    `${tableAlias}.submission_feature_id`,
    cursor.create_date,
    cursor.submission_feature_id
  ]);
}

/**
 * Recursively appends one expression-tree clause to the anchor query.
 *
 * @example
 * A predicate appends one correlated evidence condition. A regular `AND(A, OR(B, C))` recursively creates nested Knex
 * groups. A compatible range or equality expression takes the coalesced single-scan pathway before general recursion.
 *
 * @param {Knex.QueryBuilder} query - Anchor query or nested boolean expression.
 * @param {NormalizedExpressionTreeClause} clause - Clause to append.
 * @param {Knex} knex - Knex instance used to build predicate subqueries.
 * @param {number | null} [systemUserId] - Security context.
 * @return {Knex.QueryBuilder} The query with the clause appended.
 */
function applyExpressionClause(
  query: Knex.QueryBuilder,
  clause: NormalizedExpressionTreeClause,
  knex: Knex,
  systemUserId?: number | null
): Knex.QueryBuilder {
  if (clause.type === 'predicate') {
    return query.whereRaw(buildEvidenceExpression(clause, knex, systemUserId));
  }

  if (hasCompatiblePredicates(clause)) {
    return query.whereRaw(
      isAndEqualityExpression(clause)
        ? buildAndEqualityExpression(clause, knex, systemUserId)
        : buildEvidenceExpression(clause, knex, systemUserId)
    );
  }

  return query.where((expressionGroup) => {
    clause.clauses.forEach((childClause, index) => {
      const appendChild = (childGroup: Knex.QueryBuilder) => {
        applyExpressionClause(childGroup, childClause, knex, systemUserId);
      };

      if (index === 0 || clause.operator === 'AND') {
        expressionGroup.where(appendChild);
      } else {
        expressionGroup.orWhere(appendChild);
      }
    });
  });
}

/**
 * Builds a correlated match for an AND expression over one property scan per evidence direction.
 *
 * Evidence values are mapped to the current anchor before aggregation. This preserves
 * multi-valued semantics and allows separate visible related evidence features to
 * contribute different required values without repeating metadata and closure work
 * once for every predicate.
 *
 * @example
 * `Count = 77 AND Count = 100` filters one property domain to both values, maps visible direct and related evidence to
 * the current anchor, then applies `COUNT(DISTINCT matched_value) = 2`. This preserves multi-valued AND semantics while
 * avoiding two complete metadata, closure, and security probes.
 *
 * @param {NormalizedExpressionTree} expression - AND expression containing same-property equality predicates.
 * @param {Knex} knex - Knex instance used to build the expression.
 * @param {number | null} [systemUserId] - Security context for related evidence.
 * @return {Knex.Raw} Correlated boolean expression for the current anchor.
 */
function buildAndEqualityExpression(
  expression: NormalizedExpressionTree,
  knex: Knex,
  systemUserId?: number | null
): Knex.Raw {
  const predicates = getEvidencePredicates(expression);
  const property = predicates[0];
  const { tableName, valueColumn } = getPredicateTableConfig(property.internal_predicate);
  const values = getScalarPredicateValues(predicates);

  const directRows = applyPropertyReferenceLifecycleFilters(
    knex(`${tableName} as p`)
      .select({ matched_value: valueColumn })
      .whereRaw('p.submission_feature_id = anchor_sf.submission_feature_id')
      .whereIn(
        'p.feature_type_property_id',
        buildPredicateFeatureTypePropertyIdsQuery(property, knex).whereRaw(
          'ftp.feature_type_id = anchor_sf.feature_type_id'
        )
      )
      .whereIn(valueColumn, values),
    property.internal_predicate
  );

  /**
   * Maps related equality evidence to the current search anchor in one closure direction.
   *
   * @param {string} closureAlias - Unique alias for the closure relation.
   * @param {'source_submission_feature_id' | 'target_submission_feature_id'} anchorColumn - Closure column containing the anchor ID.
   * @param {'source_submission_feature_id' | 'target_submission_feature_id'} evidenceColumn - Closure column containing the evidence ID.
   * @return {Knex.QueryBuilder} Query returning matched values visible to the caller.
   */
  const buildRelatedRows = (
    closureAlias: string,
    anchorColumn: 'source_submission_feature_id' | 'target_submission_feature_id',
    evidenceColumn: 'source_submission_feature_id' | 'target_submission_feature_id'
  ) => {
    let relatedRows = applyPropertyReferenceLifecycleFilters(
      knex(`submission_feature_closure as ${closureAlias}`)
        .select({ matched_value: valueColumn })
        .join(`${tableName} as p`, 'p.submission_feature_id', `${closureAlias}.${evidenceColumn}`)
        .whereRaw(`${closureAlias}.${anchorColumn} = anchor_sf.submission_feature_id`)
        .whereIn(
          'p.feature_type_property_id',
          buildPredicateFeatureTypePropertyIdsQuery(property, knex).whereRaw(
            'ftp.feature_type_id <> anchor_sf.feature_type_id'
          )
        )
        .whereIn(valueColumn, values)
        .whereExists(
          knex('submission_feature_closure as grouped_search_evidence_self')
            .select(knex.raw('1'))
            .whereRaw('grouped_search_evidence_self.source_submission_feature_id = p.submission_feature_id')
            .whereRaw('grouped_search_evidence_self.target_submission_feature_id = p.submission_feature_id')
        ),
      property.internal_predicate
    );

    const evidenceSecurityFilter = buildSecurityFilter(knex, systemUserId, 'p.submission_feature_id');
    if (evidenceSecurityFilter) {
      relatedRows = relatedRows.whereRaw(evidenceSecurityFilter);
    }

    return relatedRows;
  };

  const mappedEvidence = directRows.unionAll(
    [
      buildRelatedRows('grouped_search_forward', 'source_submission_feature_id', 'target_submission_feature_id'),
      buildRelatedRows('grouped_search_reverse', 'target_submission_feature_id', 'source_submission_feature_id')
    ],
    true
  );
  const match = knex
    .from(mappedEvidence.as('grouped_search_evidence'))
    .select(knex.raw('true'))
    .havingRaw('count(DISTINCT grouped_search_evidence.matched_value) = ?', [values.length])
    .limit(1);

  return knex.raw('(?) IS TRUE', [match]);
}

/**
 * Builds the correlated evidence probe for one predicate leaf.
 *
 * The leaf contains three correlated scalar probes: direct same-type evidence,
 * cross-type evidence reached forward through closure, and cross-type evidence
 * reached in reverse. The scalar shape intentionally keeps each probe correlated; if
 * PostgreSQL decorrelates these broad predicates it may materialize millions of
 * evidence rows before the outer page LIMIT can stop the anchor scan.
 *
 * @example
 * For a Survey predicate and SampleSite anchor, the returned boolean is true when the anchor itself has matching
 * same-type evidence or when visible Survey evidence is connected to it through closure in either direction.
 *
 * @param {NormalizedExpressionTreeClause} evidence - Predicate or compatible same-property expression.
 * @param {Knex} knex - Knex instance used to build the subquery.
 * @param {number | null} [systemUserId] - Security context.
 * @return {Knex.Raw} Correlated boolean expression for the anchor WHERE clause.
 */
function buildEvidenceExpression(
  evidence: NormalizedExpressionTreeClause,
  knex: Knex,
  systemUserId?: number | null
): Knex.Raw {
  const predicates = getEvidencePredicates(evidence);
  const property = predicates[0];
  const operator = evidence.type === 'expression' ? evidence.operator : 'AND';
  const { tableName } = getPredicateTableConfig(property.internal_predicate);

  const directEvidence = applyEvidenceFilters(
    knex(`${tableName} as p`)
      .select(knex.raw('true'))
      .whereRaw('p.submission_feature_id = anchor_sf.submission_feature_id')
      .whereIn(
        'p.feature_type_property_id',
        buildPredicateFeatureTypePropertyIdsQuery(property, knex).whereRaw(
          'ftp.feature_type_id = anchor_sf.feature_type_id'
        )
      ),
    predicates,
    knex,
    operator
  ).limit(1);

  const buildCrossTypeEvidence = (
    closureAlias: string,
    anchorColumn: 'source_submission_feature_id' | 'target_submission_feature_id',
    evidenceColumn: 'source_submission_feature_id' | 'target_submission_feature_id'
  ) => {
    let crossTypeEvidence = applyEvidenceFilters(
      knex(`submission_feature_closure as ${closureAlias}`)
        .select(knex.raw('true'))
        .join(`${tableName} as p`, 'p.submission_feature_id', `${closureAlias}.${evidenceColumn}`)
        .whereRaw(`${closureAlias}.${anchorColumn} = anchor_sf.submission_feature_id`)
        .whereIn(
          'p.feature_type_property_id',
          buildPredicateFeatureTypePropertyIdsQuery(property, knex).whereRaw(
            'ftp.feature_type_id <> anchor_sf.feature_type_id'
          )
        )
        .whereExists(
          knex('submission_feature_closure as evidence_self')
            .select(knex.raw('1'))
            .whereRaw('evidence_self.source_submission_feature_id = p.submission_feature_id')
            .whereRaw('evidence_self.target_submission_feature_id = p.submission_feature_id')
        ),
      predicates,
      knex,
      operator
    );

    const evidenceSecurityFilter = buildSecurityFilter(knex, systemUserId, 'p.submission_feature_id');
    if (evidenceSecurityFilter) {
      crossTypeEvidence = crossTypeEvidence.whereRaw(evidenceSecurityFilter);
    }

    return crossTypeEvidence.limit(1);
  };

  const forwardEvidence = buildCrossTypeEvidence(
    'closure_forward',
    'source_submission_feature_id',
    'target_submission_feature_id'
  );
  const reverseEvidence = buildCrossTypeEvidence(
    'closure_reverse',
    'target_submission_feature_id',
    'source_submission_feature_id'
  );

  // Scalar subqueries retain their correlation under PostgreSQL planning. A
  // regular EXISTS here can be rewritten into a hashed global evidence set,
  // defeating page LIMIT for common predicates on multi-million-row tables.
  return knex.raw('((?) IS TRUE OR (?) IS TRUE OR (?) IS TRUE)', [directEvidence, forwardEvidence, reverseEvidence]);
}

/**
 * Resolves active concrete feature-type-property ids for one semantic property.
 *
 * @example
 * A predicate with `feature_property_id = 14` and `feature_type_property_id = null` returns every active assignment of
 * property 14. Supplying assignment 108 adds that exact assignment constraint and returns at most 108.
 *
 * @param {NormalizedExpressionTreePredicate} property - Predicate containing the resolved property identity.
 * @param {Knex} knex - Knex instance used to build the metadata query.
 * @return {Knex.QueryBuilder} Query returning concrete feature_type_property_id rows.
 */
function buildPredicateFeatureTypePropertyIdsQuery(
  property: NormalizedExpressionTreePredicate,
  knex: Knex
): Knex.QueryBuilder {
  const query = knex('feature_type_property as ftp')
    .select('ftp.feature_type_property_id')
    .where('ftp.feature_property_id', property.feature_property_id)
    .whereNull('ftp.record_end_date');

  if (property.feature_type_property_id !== null) {
    query.where('ftp.feature_type_property_id', property.feature_type_property_id);
  }

  return query;
}

/**
 * Returns the predicates that must be applied to the same typed-property row.
 *
 * @example
 * A predicate returns `[predicate]`. A compatible `AND(Count > 7, Count < 9)` expression returns both contained bounds.
 * General mixed expressions never reach this helper because `hasCompatiblePredicates` rejects them first.
 *
 * @param {NormalizedExpressionTreeClause} evidence - Predicate evidence representation.
 * @return {NormalizedExpressionTreePredicate[]} Predicates represented by the evidence.
 */
function getEvidencePredicates(evidence: NormalizedExpressionTreeClause): NormalizedExpressionTreePredicate[] {
  return evidence.type === 'predicate' ? [evidence] : evidence.clauses.filter((clause) => clause.type === 'predicate');
}

/**
 * Determines whether evidence is an AND expression of same-property equality predicates.
 *
 * @example
 * `AND(Count = 77, Count = 100)` returns true. `OR(Count = 77, Count = 100)`, a numeric range, and a single predicate
 * each return false.
 *
 * @param {NormalizedExpressionTreeClause} evidence - Predicate evidence representation.
 * @return {boolean} True when every predicate in an AND expression is an equality.
 */
function isAndEqualityExpression(evidence: NormalizedExpressionTreeClause): boolean {
  return (
    evidence.type === 'expression' &&
    evidence.operator === 'AND' &&
    evidence.clauses.every((clause) => clause.type === 'predicate' && clause.operator === 'Equals')
  );
}

/**
 * Applies predicates that share one typed-property-row query.
 *
 * @example
 * `AND(Count > 7, Count < 9)` appends both comparisons to the same `p` row. `OR(Count = 77, Count = 100)` appends one
 * `p.value IN (100, 77)` filter. The OR pathway is only called for compatible equality groups.
 *
 * @param {Knex.QueryBuilder} query - Query containing the shared `p` property-row alias.
 * @param {NormalizedExpressionTreePredicate[]} predicates - Predicates applied to that row.
 * @param {Knex} knex - Knex instance used by predicate helpers.
 * @param {LogicalOperator} operator - Logical operator joining the predicates.
 * @return {Knex.QueryBuilder} Query constrained by the combined predicates.
 */
function applyEvidenceFilters(
  query: Knex.QueryBuilder,
  predicates: NormalizedExpressionTreePredicate[],
  knex: Knex,
  operator: LogicalOperator
): Knex.QueryBuilder {
  if (operator === 'OR') {
    const predicate = predicates[0].internal_predicate;
    const { valueColumn } = getPredicateTableConfig(predicate);
    return applyPropertyReferenceLifecycleFilters(query, predicate).whereIn(
      valueColumn,
      getScalarPredicateValues(predicates)
    );
  }

  return predicates.reduce((filteredQuery, predicate) => applyPredicateFilters(filteredQuery, predicate, knex), query);
}

/**
 * Adds value and reference-lifecycle filters shared by each evidence direction.
 *
 * @param {Knex.QueryBuilder} query - Query containing the `p` alias.
 * @param {NormalizedExpressionTreePredicate} predicate - Predicate to apply.
 * @param {Knex} knex - Knex instance used by predicate helpers.
 * @return {Knex.QueryBuilder} Filtered evidence query.
 */
function applyPredicateFilters(
  query: Knex.QueryBuilder,
  predicate: NormalizedExpressionTreePredicate,
  knex: Knex
): Knex.QueryBuilder {
  const { tableName, valueColumn } = getPredicateTableConfig(predicate.internal_predicate);
  query = applyPropertyReferenceLifecycleFilters(query, predicate.internal_predicate);

  return predicate.operator === 'NotEquals'
    ? applyExpressionPredicateNotEquals(query, predicate, tableName, valueColumn, knex)
    : applyExpressionPredicateOperator(query, predicate.internal_predicate, valueColumn, knex);
}

/**
 * Applies lifecycle joins required by property values backed by reference tables.
 *
 * @param {Knex.QueryBuilder} query - Query containing the shared `p` property-row alias.
 * @param {InternalTypedPredicate} predicate - Typed predicate identifying the property table.
 * @return {Knex.QueryBuilder} Query constrained to active referenced values.
 */
function applyPropertyReferenceLifecycleFilters(
  query: Knex.QueryBuilder,
  predicate: InternalTypedPredicate
): Knex.QueryBuilder {
  if (predicate.type === 'taxon') {
    return query.join('taxon as t', 't.taxon_id', 'p.taxon_id').whereNull('t.record_end_date');
  }

  if (predicate.type === 'code') {
    return query
      .join('contributor_codeset_code as csc', 'csc.contributor_codeset_code_id', 'p.contributor_codeset_code_id')
      .join('contributor_codeset as cs', 'cs.contributor_codeset_id', 'csc.contributor_codeset_id')
      .whereNull('csc.record_end_date')
      .whereNull('cs.record_end_date');
  }

  return query;
}

/**
 * Resolves the typed property table and value column for an expression predicate.
 *
 * @param {InternalTypedPredicate} predicate - Normalized predicate payload.
 * @return {{ tableName: string; valueColumn: string }} Physical property table and value column configuration.
 */
function getPredicateTableConfig(predicate: InternalTypedPredicate): { tableName: string; valueColumn: string } {
  switch (predicate.type) {
    case 'string':
      return { tableName: 'submission_feature_property_string', valueColumn: 'p.value' };
    case 'number':
      return { tableName: 'submission_feature_property_number', valueColumn: 'p.value' };
    case 'boolean':
      return { tableName: 'submission_feature_property_boolean', valueColumn: 'p.value' };
    case 'timestamp':
      return { tableName: 'submission_feature_property_timestamp', valueColumn: 'p.value' };
    case 'taxon':
      return { tableName: 'submission_feature_property_taxon', valueColumn: 'p.taxon_id' };
    case 'geometry':
      return { tableName: 'submission_feature_property_geometry', valueColumn: 'p.value' };
    case 'code':
      return { tableName: 'submission_feature_property_code', valueColumn: 'p.contributor_codeset_code_id' };
    default: {
      const exhaustivePredicate: never = predicate;
      throw new ApiBuildSQLError('Unsupported expression predicate type', [
        'expression-evaluation->getPredicateTableConfig',
        { predicate: exhaustivePredicate }
      ]);
    }
  }
}

/**
 * Applies feature-level NotEquals semantics for multi-value property rows.
 *
 * Row-level `p.value <> X` is incorrect for multi-value properties because a feature with
 * values [red, blue] would match `NotEquals red` through the blue row. This predicate means
 * the evidence feature has no row for the semantic property equal to the requested value.
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {NormalizedExpressionTreePredicate} clause - Normalized NotEquals predicate clause.
 * @param {string} tableName - Typed property table containing candidate value rows.
 * @param {string} valueColumn - Candidate value column reference prefixed with the `p` alias.
 * @param {Knex} knex - Knex instance used to build the anti-match subquery.
 * @return {Knex.QueryBuilder} Evidence query with feature-level NotEquals semantics applied.
 */
function applyExpressionPredicateNotEquals(
  query: Knex.QueryBuilder,
  clause: NormalizedExpressionTreePredicate,
  tableName: string,
  valueColumn: string,
  knex: Knex
): Knex.QueryBuilder {
  const columnName = valueColumn.replace('p.', '');
  const value = getScalarPredicateValue(clause.internal_predicate);

  if (clause.feature_type_property_id !== null) {
    return query.whereNotExists(
      knex(`${tableName} as p_not_equals`)
        .select(knex.raw('1'))
        .whereRaw('p_not_equals.submission_feature_id = p.submission_feature_id')
        .where('p_not_equals.feature_type_property_id', clause.feature_type_property_id)
        .where(`p_not_equals.${columnName}`, value)
    );
  }

  return query.whereNotExists(
    knex(`${tableName} as p_not_equals`)
      .select(knex.raw('1'))
      .join(
        'feature_type_property as ftp_not_equals',
        'ftp_not_equals.feature_type_property_id',
        'p_not_equals.feature_type_property_id'
      )
      .whereRaw('p_not_equals.submission_feature_id = p.submission_feature_id')
      .where('ftp_not_equals.feature_property_id', clause.feature_property_id)
      .where(`p_not_equals.${columnName}`, value)
      .whereNull('ftp_not_equals.record_end_date')
  );
}

/**
 * Get a scalar predicate value for SQL equality comparisons.
 *
 * @param {InternalTypedPredicate} predicate - Normalized predicate payload.
 * @return {string | number | boolean | undefined} Scalar value suitable for single-column comparisons.
 */
function getScalarPredicateValue(predicate: InternalTypedPredicate): string | number | boolean | undefined {
  if (!('value' in predicate)) {
    return undefined;
  }

  if (
    predicate.value === undefined ||
    typeof predicate.value === 'string' ||
    typeof predicate.value === 'number' ||
    typeof predicate.value === 'boolean'
  ) {
    return predicate.value;
  }

  throw new ApiBuildSQLError('Predicate value is not scalar', [
    'expression-evaluation->getScalarPredicateValue',
    { predicate }
  ]);
}

/**
 * Extracts defined scalar values from equality predicates in an optimized expression.
 *
 * @param {NormalizedExpressionTreePredicate[]} predicates - Predicates requiring scalar values.
 * @return {(string | number | boolean)[]} Defined values suitable for SQL IN and aggregation.
 */
function getScalarPredicateValues(
  predicates: readonly NormalizedExpressionTreePredicate[]
): (string | number | boolean)[] {
  return predicates.map((predicate) => {
    const value = getScalarPredicateValue(predicate.internal_predicate);
    if (value === undefined) {
      throw new ApiBuildSQLError('Optimized equality predicate requires a scalar value', [
        'expression-evaluation->getScalarPredicateValues',
        { predicate }
      ]);
    }

    return value;
  });
}

/**
 * Applies a typed expression predicate operator to a property value query.
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {InternalTypedPredicate} predicate - Normalized predicate payload.
 * @param {string} valueColumn - Typed property value column reference.
 * @param {Knex} knex - Knex instance used by predicate helpers that need raw subqueries.
 * @return {Knex.QueryBuilder} Evidence query with the predicate operator applied.
 */
function applyExpressionPredicateOperator(
  query: Knex.QueryBuilder,
  predicate: InternalTypedPredicate,
  valueColumn: string,
  knex: Knex
): Knex.QueryBuilder {
  if (predicate.type === 'timestamp') {
    return applyTimestampExpressionOperator(query, predicate);
  }

  if (predicate.operator === 'Exists') {
    return query.whereNotNull(valueColumn);
  }

  switch (predicate.type) {
    case 'string':
      return applyStringExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
    case 'number':
      return applyComparableExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
    case 'boolean':
      return query.where(valueColumn, predicate.value);
    case 'taxon':
      return applyTaxonExpressionOperator(query, valueColumn, predicate.operator, predicate.value, knex);
    case 'geometry':
      return applyGeometryExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
    case 'code':
      return applyComparableExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
    default: {
      const exhaustivePredicate: never = predicate;
      throw new ApiBuildSQLError('Unsupported expression predicate type', [
        'expression-evaluation->applyExpressionPredicateOperator',
        { predicate: exhaustivePredicate }
      ]);
    }
  }
}

/**
 * Applies a string expression operator.
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {string} column - String value column reference.
 * @param {InternalTypedPredicate['operator']} operator - String predicate operator.
 * @param {string | undefined} value - String comparison value.
 * @return {Knex.QueryBuilder} Evidence query with the string operator applied.
 */
function applyStringExpressionOperator(
  query: Knex.QueryBuilder,
  column: string,
  operator: InternalTypedPredicate['operator'],
  value: string | undefined
): Knex.QueryBuilder {
  switch (operator) {
    case 'Equals':
      return query.where(column, value);
    case 'NotEquals':
      return query.whereNot(column, value);
    case 'Like':
      return query.whereRaw(`${column} LIKE ?`, [value]);
    case 'ILike':
    case 'Contains':
      return query.whereRaw(`${column} ILIKE ?`, [`%${value}%`]);
    case 'StartsWith':
      return query.whereRaw(`${column} ILIKE ?`, [`${value}%`]);
    case 'EndsWith':
      return query.whereRaw(`${column} ILIKE ?`, [`%${value}`]);
    default:
      return query;
  }
}

/**
 * Applies an equality/comparison expression operator.
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {string} column - Comparable value column reference.
 * @param {InternalTypedPredicate['operator']} operator - Comparable predicate operator.
 * @param {string | number | boolean | undefined} value - Comparison value.
 * @return {Knex.QueryBuilder} Evidence query with the comparable operator applied.
 */
function applyComparableExpressionOperator(
  query: Knex.QueryBuilder,
  column: string,
  operator: InternalTypedPredicate['operator'],
  value: string | number | boolean | undefined
): Knex.QueryBuilder {
  switch (operator) {
    case 'Equals':
      return query.where(column, value);
    case 'NotEquals':
      return query.whereNot(column, value);
    case 'GreaterThan':
      return query.whereRaw(`${column} > ?`, [value]);
    case 'GreaterThanOrEqual':
      return query.whereRaw(`${column} >= ?`, [value]);
    case 'LessThan':
      return query.whereRaw(`${column} < ?`, [value]);
    case 'LessThanOrEqual':
      return query.whereRaw(`${column} <= ?`, [value]);
    default:
      return query;
  }
}

/**
 * Applies a timestamp expression operator.
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {InternalTimestampPredicate} predicate - Normalized timestamp predicate payload.
 * @return {Knex.QueryBuilder} Evidence query with the timestamp operator applied.
 */
function applyTimestampExpressionOperator(
  query: Knex.QueryBuilder,
  predicate: InternalTimestampPredicate
): Knex.QueryBuilder {
  const columns = { date: 'p.date_value', time: 'p.time_value' };

  switch (predicate.operator) {
    case 'Exists':
      return query.whereRaw(`(${columns.date} IS NOT NULL OR ${columns.time} IS NOT NULL)`);
    case 'OnDate':
      if (!predicate.value?.date_value) {
        throw new ApiBuildSQLError('OnDate timestamp predicate requires a date value', [
          'expression-evaluation->applyTimestampExpressionOperator',
          { predicate }
        ]);
      }

      return query.whereRaw(`${columns.date} = ?::date`, [predicate.value.date_value]);
    case 'OnTime':
      if (!predicate.value?.time_value) {
        throw new ApiBuildSQLError('OnTime timestamp predicate requires a time value', [
          'expression-evaluation->applyTimestampExpressionOperator',
          { predicate }
        ]);
      }

      return query.whereRaw(`${columns.time} = ?::time`, [predicate.value.time_value]);
    case 'Before':
    case 'After':
      return applyTimestampComparisonOperator(query, predicate, predicate.operator, columns);
    default:
      throw new ApiBuildSQLError('Unsupported timestamp predicate operator', [
        'expression-evaluation->applyTimestampExpressionOperator',
        { operator: predicate.operator }
      ]);
  }
}

/**
 * Applies Before/After comparisons using the timestamp component(s) present in the predicate value.
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {InternalTimestampPredicate} predicate - Normalized timestamp predicate payload.
 * @param {'Before' | 'After'} operator - Timestamp comparison operator.
 * @param {{ date: string; time: string }} columns - Timestamp date/time column references.
 * @return {Knex.QueryBuilder} Evidence query with the timestamp comparison applied.
 */
function applyTimestampComparisonOperator(
  query: Knex.QueryBuilder,
  predicate: InternalTimestampPredicate,
  operator: 'Before' | 'After',
  columns: { date: string; time: string }
): Knex.QueryBuilder {
  if (!predicate.value) {
    throw new ApiBuildSQLError('Timestamp predicate requires a value', [
      'expression-evaluation->applyTimestampComparisonOperator',
      { predicate }
    ]);
  }

  const value = predicate.value;
  const comparator = operator === 'Before' ? '<' : '>';
  const hasDate = Boolean(value.date_value);
  const hasTime = Boolean(value.time_value);

  if (hasDate && hasTime) {
    return query.whereRaw(`(${columns.date} + ${columns.time}) ${comparator} (?::date + ?::time)`, [
      value.date_value,
      value.time_value
    ]);
  }

  if (hasDate) {
    return query.whereRaw(`${columns.date} ${comparator} ?::date`, [value.date_value]);
  }

  if (!hasTime) {
    throw new ApiBuildSQLError('Timestamp comparison predicate requires a date or time value', [
      'expression-evaluation->applyTimestampComparisonOperator',
      { predicate }
    ]);
  }

  return query.whereRaw(`${columns.time} ${comparator} ?::time`, [value.time_value]);
}

/**
 * Applies a taxon expression operator.
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {string} column - Taxon id column reference.
 * @param {InternalTypedPredicate['operator']} operator - Taxon predicate operator.
 * @param {number | undefined} value - Target taxon id.
 * @param {Knex} knex - Knex instance used to build recursive taxon subqueries.
 * @return {Knex.QueryBuilder} Evidence query with the taxon operator applied.
 *
 * Exported so the parent-child hierarchy operators can be exercised directly against a real database
 * in integration tests (they walk the `taxon.parent_taxon_id` self-reference via recursive CTEs).
 */
export function applyTaxonExpressionOperator(
  query: Knex.QueryBuilder,
  column: string,
  operator: InternalTypedPredicate['operator'],
  value: number | undefined,
  knex: Knex
): Knex.QueryBuilder {
  switch (operator) {
    case 'Equals':
      return query.where(column, value);
    case 'ParentOf':
      return query.whereRaw('EXISTS (?)', [buildTaxonAncestorExistsQuery(knex, value, column, false)]);
    case 'ChildOf':
      return query.whereRaw(`(SELECT parent_taxon_id FROM taxon WHERE taxon_id = ${column}) = ?`, [value]);
    case 'DescendsFrom':
      return query.whereRaw('EXISTS (?)', [buildTaxonDescendantExistsQuery(knex, value, column)]);
    case 'AscendsFrom':
      return query.whereRaw('EXISTS (?)', [buildTaxonAncestorExistsQuery(knex, value, column, true)]);
    default:
      return query;
  }
}

/**
 * Builds a recursive query checking whether the candidate taxon is an ancestor of the target taxon.
 *
 * @param {Knex} knex - Knex instance used to build the raw recursive query.
 * @param {number | undefined} targetTaxonId - Target taxon id supplied by the predicate.
 * @param {string} candidateTaxonColumn - Candidate taxon column reference from the evidence row.
 * @param {boolean} includeAllAncestors - Whether to include all ancestors instead of only the direct parent.
 * @return {Knex.Raw} Raw EXISTS subquery for ancestor matching.
 */
function buildTaxonAncestorExistsQuery(
  knex: Knex,
  targetTaxonId: number | undefined,
  candidateTaxonColumn: string,
  includeAllAncestors: boolean
): Knex.Raw {
  const recursiveLimit = includeAllAncestors ? '' : 'AND depth = 1';

  return knex.raw(
    `WITH RECURSIVE ancestors AS (
      SELECT taxon_id, parent_taxon_id, 0 AS depth
      FROM taxon
      WHERE taxon_id = ?
      UNION ALL
      SELECT parent.taxon_id, parent.parent_taxon_id, ancestors.depth + 1
      FROM taxon parent
      JOIN ancestors ON parent.taxon_id = ancestors.parent_taxon_id
      WHERE parent.record_end_date IS NULL
    )
    SELECT 1
    FROM ancestors
    WHERE taxon_id = ${candidateTaxonColumn}
    ${recursiveLimit}`,
    [targetTaxonId]
  );
}

/**
 * Builds a recursive query checking whether the candidate taxon descends from the target taxon.
 *
 * @param {Knex} knex - Knex instance used to build the raw recursive query.
 * @param {number | undefined} targetTaxonId - Target ancestor taxon id supplied by the predicate.
 * @param {string} candidateTaxonColumn - Candidate taxon column reference from the evidence row.
 * @return {Knex.Raw} Raw EXISTS subquery for descendant matching.
 */
function buildTaxonDescendantExistsQuery(
  knex: Knex,
  targetTaxonId: number | undefined,
  candidateTaxonColumn: string
): Knex.Raw {
  return knex.raw(
    `WITH RECURSIVE ancestors AS (
      SELECT taxon_id, parent_taxon_id
      FROM taxon
      WHERE taxon_id = ${candidateTaxonColumn}
      UNION ALL
      SELECT parent.taxon_id, parent.parent_taxon_id
      FROM taxon parent
      JOIN ancestors ON parent.taxon_id = ancestors.parent_taxon_id
      WHERE parent.record_end_date IS NULL
    )
    SELECT 1
    FROM ancestors
    WHERE taxon_id = ?`,
    [targetTaxonId]
  );
}

/**
 * Applies a geometry expression operator.
 *
 * @param {Knex.QueryBuilder} query - The query to apply the operator to.
 * @param {string} column - The geometry column reference (e.g. `p.value`).
 * @param {InternalTypedPredicate['operator']} operator - The geometry operator (`Within`, `Intersects`, `Contains`).
 * @param {unknown} value - GeoJSON geometry value to compare against.
 * @return {Knex.QueryBuilder} The query with the geometry predicate applied.
 */
function applyGeometryExpressionOperator(
  query: Knex.QueryBuilder,
  column: string,
  operator: InternalTypedPredicate['operator'],
  value: unknown
): Knex.QueryBuilder {
  const geometry = 'public.ST_Force2D(public.ST_GeomFromGeoJSON(?))';
  const geoJson = JSON.stringify(value);

  switch (operator) {
    case 'Within':
      return query.whereRaw(`public.ST_Within(${column}, ${geometry})`, [geoJson]);
    case 'Intersects':
      return query.whereRaw(`public.ST_Intersects(${column}, ${geometry})`, [geoJson]);
    case 'Contains':
      return query.whereRaw(`public.ST_Contains(${column}, ${geometry})`, [geoJson]);
    default:
      return query;
  }
}
