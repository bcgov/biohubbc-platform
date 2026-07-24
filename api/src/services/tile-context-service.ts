import { IDBConnection } from '../database/db';
import { ExpressionTree } from '../models/expression-tree';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import { TileContextAccessClass } from '../models/tile-context';
import { SecurityScopeRepository } from '../repositories/authorization/security-scope-repository';
import { dependencies as expressionEvaluation } from '../repositories/expression-evaluation';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { TileContextRepository } from '../repositories/tile-context-repository';
import { getLogger } from '../utils/logger';
import { computeTileContextHash } from '../utils/tile-context-hash';
import { DBService } from './db-service';
import { ExpressionPredicateSemanticValidator } from './expression-predicate-semantic-validator';
import { ExpressionTreeService } from './expression-tree-service';

const defaultLog = getLogger('services/tile-context-service');

/** How long a tile context lives, seconds. */
const DEFAULT_CONTEXT_TTL_SECONDS = 1800;
/** Maximum features materialized for one context. */
const DEFAULT_MAX_FEATURES = 50000;
/** Must match the tile token lifetime, so a reused context always outlives the token issued for it. */
const DEFAULT_TOKEN_TTL_SECONDS = 900;

/** A search too large to map. No token is issued. */
export interface TileContextOverCapResult {
  overCap: true;
  cap: number;
}

export interface TileContextResult {
  overCap: false;
  tileContextId: string;
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
 * Service for creating the server-side authorization context behind a map tile session.
 *
 * The browser never receives anything but an opaque id. Everything that decides what a tile may
 * contain — access class, resolved security scopes, and the materialized result set — is stored here
 * and re-evaluated in SQL when the tile is generated.
 *
 * Identity and result resolution deliberately reuse the feature-search primitives rather than
 * reimplementing them, so the map and the table cannot drift apart.
 */
export class TileContextService extends DBService {
  tileContextRepository: TileContextRepository;
  searchFeatureRepository: SearchFeatureRepository;
  securityScopeRepository: SecurityScopeRepository;
  submissionRepository: SubmissionRepository;
  expressionTreeService: ExpressionTreeService;
  semanticValidator: ExpressionPredicateSemanticValidator;

  constructor(connection: IDBConnection) {
    super(connection);

    this.tileContextRepository = new TileContextRepository(connection);
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
   * @return {Promise<TileContextResult | TileContextOverCapResult>}
   * @memberof TileContextService
   */
  async createOrReuseTileContext(
    featureTypeName: string,
    expressionTree: ExpressionTree | undefined,
    systemUserId: number | null
  ): Promise<TileContextResult | TileContextOverCapResult> {
    const cap = Number(process.env.TILE_CONTEXT_MAX_FEATURES) || DEFAULT_MAX_FEATURES;
    const contextTtlSeconds = Number(process.env.TILE_CONTEXT_TTL_SECONDS) || DEFAULT_CONTEXT_TTL_SECONDS;
    const tokenTtlSeconds = Number(process.env.TILE_TOKEN_TTL_SECONDS) || DEFAULT_TOKEN_TTL_SECONDS;

    // Resolved exactly as feature search resolves it, so an unknown feature type fails identically.
    const { feature_type_id } = await this.submissionRepository.getFeatureTypeIdByName(featureTypeName);

    // Normalization must happen before hashing, or the same search could produce two identities.
    const normalizedExpression: NormalizedExpressionTreeExpression | undefined = expressionTree
      ? await this.semanticValidator.validateExpressionTree(expressionTree)
      : undefined;

    const accessClass: TileContextAccessClass = systemUserId ? 'scoped' : 'anon';

    // Captured now and stored on the context, so the tile function never needs a user id.
    const securityScopeIds = systemUserId
      ? (await this.securityScopeRepository.getSecurityScopeIdsForSystemUser(systemUserId)).map(
          (row) => row.security_scope_id
        )
      : [];

    const expressionHash = normalizedExpression
      ? this.expressionTreeService.computeExpressionTreeHash(normalizedExpression)
      : null;

    const contextHash = computeTileContextHash({
      expressionHash,
      featureTypeId: feature_type_id,
      accessClass,
      securityScopeIds
    });

    await this.tileContextRepository.deleteExpiredContextsByHash(contextHash);

    // Recomputed even for a reused context: features may have been secured since it was created, and
    // this drives the "some results are hidden" notice.
    const hasMoreSecuredFeatures = await this.searchFeatureRepository.hasInaccessibleSecuredFeaturesByExpressionTree(
      featureTypeName,
      normalizedExpression,
      systemUserId
    );

    const reusable = await this.tileContextRepository.findReusableLiveContext(contextHash, tokenTtlSeconds);

    if (reusable) {
      // NOTE: log the expression hash, never the expression itself.
      defaultLog.info({
        label: 'createOrReuseTileContext',
        message: 'reused tile context',
        tile_context_id: reusable.tile_context_id,
        access_class: accessClass,
        expression_hash: expressionHash
      });

      return {
        overCap: false,
        tileContextId: reusable.tile_context_id,
        expiresInSeconds: reusable.expires_in_seconds,
        boundingBox: await this.tileContextRepository.updateContextBoundingBox(reusable.tile_context_id),
        featureCount: null,
        hasMoreSecuredFeatures
      };
    }

    const created = await this.tileContextRepository.insertTileContext(
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

      featureCount = await this.tileContextRepository.materializeContextFeatures(
        created.tile_context_id,
        featureIdsSubquery,
        cap + 1
      );

      if (featureCount > cap) {
        // Refuse rather than truncate. A capped subset would be spatially biased, and a map that
        // silently shows part of a result set is worse than one that says it cannot show it.
        await this.tileContextRepository.deleteTileContext(created.tile_context_id);

        defaultLog.info({
          label: 'createOrReuseTileContext',
          message: 'tile context over cap, refused',
          cap,
          access_class: accessClass,
          expression_hash: expressionHash
        });

        return { overCap: true, cap };
      }

      boundingBox = await this.tileContextRepository.updateContextBoundingBox(created.tile_context_id);
    }

    defaultLog.info({
      label: 'createOrReuseTileContext',
      message: 'created tile context',
      tile_context_id: created.tile_context_id,
      access_class: accessClass,
      expression_hash: expressionHash,
      feature_count: featureCount
    });

    return {
      overCap: false,
      tileContextId: created.tile_context_id,
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
   * @memberof TileContextService
   */
  async deleteExpiredTileContexts(): Promise<number> {
    const deleted = await this.tileContextRepository.deleteExpiredContexts();

    if (deleted) {
      defaultLog.info({ label: 'deleteExpiredTileContexts', message: 'deleted expired tile contexts', deleted });
    }

    return deleted;
  }
}
