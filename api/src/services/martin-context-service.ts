import { IDBConnection } from '../database/db';
import { HTTP503 } from '../errors/http-error';
import { ExpressionTree } from '../models/expression-tree';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import { MartinContextAccessClass } from '../models/martin-context';
import { SecurityScopeRepository } from '../repositories/authorization/security-scope-repository';
import { dependencies as expressionEvaluation } from '../repositories/expression-evaluation';
import { MartinContextRepository } from '../repositories/martin-context-repository';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
import { computeMartinContextHash } from '../utils/martin-context-hash';
import { DBService } from './db-service';
import { ExpressionPredicateSemanticValidator } from './expression-predicate-semantic-validator';
import { ExpressionTreeService } from './expression-tree-service';

const defaultLog = getLogger('services/martin-context-service');

/** How long a tile context lives, seconds. */
const DEFAULT_CONTEXT_TTL_SECONDS = 1800;
/** Maximum features materialized for one context. */
const DEFAULT_MAX_FEATURES = 50000;
/** Must match the tile token lifetime, so a reused context always outlives the token issued for it. */
const DEFAULT_TOKEN_TTL_SECONDS = 900;
/**
 * Maximum live (unexpired) MATERIALIZED contexts. At the cap a new one evicts the context closest to
 * expiry rather than being refused, so the bound costs the least useful session rather than locking
 * every caller out of new searches. Browse-all contexts are not materialized and are never capped.
 */
const DEFAULT_MAX_LIVE_CONTEXTS = 200;

/** A search too large to map. No token is issued. */
export interface MartinContextOverCapResult {
  overCap: true;
  cap: number;
}

export interface MartinContextResult {
  overCap: false;
  martinContextId: string;
  /** Remaining context lifetime, seconds. */
  expiresInSeconds: number;
  /** Extent of the matched geometries, or null for an unfiltered session. */
  boundingBox: [number, number, number, number] | null;
  /** Features materialized, or null when the session is rule-based rather than materialized. */
  featureCount: number | null;
  /** True when the search matched secured features this caller may not see. */
  hasMoreSecuredFeatures: boolean;
}

/**
 * Service for creating the server-side authorization context behind a map Martin session.
 *
 * The browser never receives anything but an opaque id. Everything that decides what a tile may
 * contain — access class, resolved security scopes, and the materialized result set — is stored here
 * and re-evaluated in SQL when the tile is generated.
 *
 * Identity and result resolution deliberately reuse the feature-search primitives rather than
 * reimplementing them, so the map and the table cannot drift apart.
 */
export class MartinContextService extends DBService {
  martinContextRepository: MartinContextRepository;
  searchFeatureRepository: SearchFeatureRepository;
  securityScopeRepository: SecurityScopeRepository;
  submissionRepository: SubmissionRepository;
  expressionTreeService: ExpressionTreeService;
  semanticValidator: ExpressionPredicateSemanticValidator;

  constructor(connection: IDBConnection) {
    super(connection);

    this.martinContextRepository = new MartinContextRepository(connection);
    this.searchFeatureRepository = new SearchFeatureRepository(connection);
    this.securityScopeRepository = new SecurityScopeRepository(connection);
    this.submissionRepository = new SubmissionRepository(connection);
    this.expressionTreeService = new ExpressionTreeService(connection);
    this.semanticValidator = new ExpressionPredicateSemanticValidator(connection);
  }

  /**
   * Create a tile context, or reuse a live one for an identical request.
   *
   * @param {string} featureTypeName
   * @param {(ExpressionTree | undefined)} expressionTree - Omitted for an unfiltered browse-all view.
   * @param {(number | null)} systemUserId - As resolved by the search paths: null when anonymous.
   * @return {Promise<MartinContextResult | MartinContextOverCapResult>}
   * @memberof MartinContextService
   */
  async createOrReuseMartinContext(
    featureTypeName: string,
    expressionTree: ExpressionTree | undefined,
    systemUserId: number | null
  ): Promise<MartinContextResult | MartinContextOverCapResult> {
    const cap = Number(process.env.MARTIN_CONTEXT_MAX_FEATURES) || DEFAULT_MAX_FEATURES;
    const contextTtlSeconds = Number(process.env.MARTIN_CONTEXT_TTL_SECONDS) || DEFAULT_CONTEXT_TTL_SECONDS;
    const tokenTtlSeconds = Number(process.env.MARTIN_TOKEN_TTL_SECONDS) || DEFAULT_TOKEN_TTL_SECONDS;

    // Resolved exactly as feature search resolves it, so an unknown feature type fails identically.
    const { feature_type_id } = await this.submissionRepository.getFeatureTypeIdByName(featureTypeName);

    // Normalization must happen before hashing, or the same search could produce two identities.
    const normalizedExpression: NormalizedExpressionTreeExpression | undefined = expressionTree
      ? await this.semanticValidator.validateExpressionTree(expressionTree)
      : undefined;

    const accessClass: MartinContextAccessClass = systemUserId ? 'scoped' : 'anon';

    // Captured now and stored on the context, so the tile function never needs a user id.
    const securityScopeIds = systemUserId
      ? (await this.securityScopeRepository.getSecurityScopeIdsForSystemUser(systemUserId)).map(
          (row) => row.security_scope_id
        )
      : [];

    const expressionHash = normalizedExpression
      ? this.expressionTreeService.computeExpressionTreeHash(normalizedExpression)
      : null;

    const contextHash = computeMartinContextHash({
      expressionHash,
      featureTypeId: feature_type_id,
      accessClass,
      securityScopeIds
    });

    await this.martinContextRepository.deleteExpiredContextsByHash(contextHash);

    // Recomputed even for a reused context: features may have been secured since it was created, and
    // this drives the "some results are hidden" notice.
    const hasMoreSecuredFeatures = await this.searchFeatureRepository.hasInaccessibleSecuredFeaturesByExpressionTree(
      featureTypeName,
      normalizedExpression,
      systemUserId
    );

    const reusable = await this.martinContextRepository.findReusableLiveContext(contextHash, tokenTtlSeconds);

    if (reusable) {
      // NOTE: log the expression hash, never the expression itself.
      defaultLog.info({
        label: 'createOrReuseMartinContext',
        message: 'reused tile context',
        martin_context_id: reusable.martin_context_id,
        access_class: accessClass,
        expression_hash: expressionHash
      });

      return {
        overCap: false,
        martinContextId: reusable.martin_context_id,
        expiresInSeconds: reusable.expires_in_seconds,
        boundingBox: await this.martinContextRepository.getContextBoundingBox(reusable.martin_context_id),
        featureCount: null,
        hasMoreSecuredFeatures
      };
    }

    const maxLiveContexts = Number(process.env.MARTIN_CONTEXT_MAX_LIVE) || DEFAULT_MAX_LIVE_CONTEXTS;

    if (normalizedExpression && maxLiveContexts < 1) {
      // Misconfiguration, not load: a cap below one leaves no room to evict into. Refusing is the
      // only honest answer, and it is the only path that still reaches this error. Checked before
      // any write, so a refused request costs nothing.
      throw new HTTP503('The map service is busy. Try again shortly.');
    }

    const created = await this.martinContextRepository.insertMartinContext(
      {
        context_hash: contextHash,
        access_class: accessClass,
        feature_type_id,
        security_scope_ids: securityScopeIds,
        expression_hash: expressionHash,
        // An unfiltered view is rule-based: matching every feature of the type would be pointless to
        // materialize, and would put a whole-table snapshot in a cache table.
        is_materialized: Boolean(normalizedExpression)
      },
      contextTtlSeconds
    );

    let featureCount: number | null = null;
    let boundingBox: [number, number, number, number] | null = null;

    if (normalizedExpression) {
      // The same security-filtered subquery the table view runs, so both resolve one result set.
      const featureIdsSubquery = expressionEvaluation.buildExpressionTreeFeatureIdsSubquery(
        featureTypeName,
        normalizedExpression,
        systemUserId
      );

      featureCount = await this.martinContextRepository.materializeContextFeatures(
        created.martin_context_id,
        featureIdsSubquery,
        cap + 1
      );

      if (featureCount > cap) {
        // Refuse rather than truncate. A capped subset would be spatially biased, and a map that
        // silently shows part of a result set is worse than one that says it cannot show it.
        //
        // Nothing has been evicted at this point — the live-context cap is enforced BELOW, only
        // once this check has passed — so a refused search costs no one else their session.
        await this.martinContextRepository.deleteMartinContext(created.martin_context_id);

        defaultLog.info({
          label: 'createOrReuseMartinContext',
          message: 'tile context over cap, refused',
          cap,
          access_class: accessClass,
          expression_hash: expressionHash
        });

        return { overCap: true, cap };
      }

      boundingBox = await this.martinContextRepository.updateContextBoundingBox(created.martin_context_id);

      // Bound the materialization an anonymous caller can force by varying an expression per
      // request. Scoped to MATERIALIZED contexts, and enforced by eviction rather than refusal,
      // because both of the obvious alternatives are worse than the problem: a browse-all context
      // is one row and refusing it buys nothing, and a global refusal hands anyone a denial of
      // service costing one request per context. Evicting the context closest to expiry puts the
      // cost on the least useful session instead, and that caller re-mints on its next refresh.
      //
      // ORDER MATTERS: this runs only after the over-cap refusal above, so a search too large to
      // map can never evict a live context and then discard its own — which would make over-cap
      // requests a free eviction attack, blanking one working map per request while never
      // occupying a slot. The new context is passed so it can never be chosen as its own victim.
      const evicted = await this.martinContextRepository.enforceMaterializedContextCap(
        maxLiveContexts,
        created.martin_context_id
      );

      if (evicted) {
        defaultLog.warn({
          label: 'createOrReuseMartinContext',
          message: 'live materialized tile context cap reached; evicted the contexts closest to expiry',
          evicted,
          max_live_contexts: maxLiveContexts
        });
      }
    }

    defaultLog.info({
      label: 'createOrReuseMartinContext',
      message: 'created tile context',
      martin_context_id: created.martin_context_id,
      access_class: accessClass,
      expression_hash: expressionHash,
      feature_count: featureCount
    });

    return {
      overCap: false,
      martinContextId: created.martin_context_id,
      expiresInSeconds: created.expires_in_seconds,
      boundingBox,
      featureCount,
      hasMoreSecuredFeatures
    };
  }

  /**
   * Delete every expired tile context. Materialized ids cascade.
   *
   * @return {Promise<number>} Contexts deleted.
   * @memberof MartinContextService
   */
  async deleteExpiredMartinContexts(): Promise<number> {
    const deleted = await this.martinContextRepository.deleteExpiredContexts();

    if (deleted) {
      defaultLog.info({ label: 'deleteExpiredMartinContexts', message: 'deleted expired tile contexts', deleted });
    }

    return deleted;
  }
}
