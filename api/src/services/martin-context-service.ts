import { IDBConnection } from '../database/db';
import { HTTP503 } from '../errors/http-error';
import { ExpressionTree } from '../models/expression-tree';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
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
/** Must match the tile token lifetime, so a reused context always outlives the token issued for it. */
const DEFAULT_TOKEN_TTL_SECONDS = 900;
/**
 * Maximum live (unexpired) contexts. At the cap a new one evicts the context closest to expiry
 * rather than being refused, so the bound costs the least useful session rather than locking every
 * caller out of new searches.
 */
const DEFAULT_MAX_LIVE_CONTEXTS = 200;

export interface MartinContextResult {
  martinContextId: string;
  /** Remaining context lifetime, seconds. */
  expiresInSeconds: number;
  /** True when the search matched secured features this caller may not see. */
  hasMoreSecuredFeatures: boolean;
}

/**
 * Service for creating the server-side authorization context behind a map Martin session.
 *
 * The browser never receives anything but an opaque id. A context references the persisted search
 * expression and the caller's identity; the tile function evaluates both live, in SQL, every time a
 * tile is generated. Nothing about the result set is materialized, so a search of any size can be
 * mapped.
 *
 * Expression persistence and identity resolution deliberately reuse the feature-search primitives
 * rather than reimplementing them, so the map and the table cannot drift apart.
 */
export class MartinContextService extends DBService {
  martinContextRepository: MartinContextRepository;
  searchFeatureRepository: SearchFeatureRepository;
  submissionRepository: SubmissionRepository;
  expressionTreeService: ExpressionTreeService;
  semanticValidator: ExpressionPredicateSemanticValidator;

  constructor(connection: IDBConnection) {
    super(connection);

    this.martinContextRepository = new MartinContextRepository(connection);
    this.searchFeatureRepository = new SearchFeatureRepository(connection);
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
   * @return {Promise<MartinContextResult>}
   * @memberof MartinContextService
   */
  async createOrReuseMartinContext(
    featureTypeName: string,
    expressionTree: ExpressionTree | undefined,
    systemUserId: number | null
  ): Promise<MartinContextResult> {
    const contextTtlSeconds = Number(process.env.MARTIN_CONTEXT_TTL_SECONDS) || DEFAULT_CONTEXT_TTL_SECONDS;
    const tokenTtlSeconds = Number(process.env.MARTIN_TOKEN_TTL_SECONDS) || DEFAULT_TOKEN_TTL_SECONDS;

    // Resolved exactly as feature search resolves it, so an unknown feature type fails identically.
    const { feature_type_id } = await this.submissionRepository.getFeatureTypeIdByName(featureTypeName);

    // Normalized for the secured-results probe below; persistence runs the same validator
    // internally, so both operate on one identity for the search.
    const normalizedExpression: NormalizedExpressionTreeExpression | undefined = expressionTree
      ? await this.semanticValidator.validateExpressionTree(expressionTree)
      : undefined;

    // Persisting (with reuse by semantic hash) is what gives the search a stable id the tile
    // function can evaluate at serve time. NULL means browse-all: no filtering beyond the feature
    // type and the caller's authorization.
    const expressionId = expressionTree
      ? (await this.expressionTreeService.writeExpressionTree(expressionTree)).expression_id
      : null;

    const contextHash = computeMartinContextHash({
      expressionId,
      featureTypeId: feature_type_id,
      systemUserId: systemUserId ?? null
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
      // NOTE: log the expression id, never the expression itself.
      defaultLog.info({
        label: 'createOrReuseMartinContext',
        message: 'reused tile context',
        martin_context_id: reusable.martin_context_id,
        expression_id: expressionId
      });

      return {
        martinContextId: reusable.martin_context_id,
        expiresInSeconds: reusable.expires_in_seconds,
        hasMoreSecuredFeatures
      };
    }

    const maxLiveContexts = Number(process.env.MARTIN_CONTEXT_MAX_LIVE) || DEFAULT_MAX_LIVE_CONTEXTS;

    if (maxLiveContexts < 1) {
      // Misconfiguration, not load: a cap below one leaves no room to evict into. Refusing is the
      // only honest answer. Checked before any write, so a refused request costs nothing.
      throw new HTTP503('The map service is busy. Try again shortly.');
    }

    const created = await this.martinContextRepository.insertMartinContext(
      {
        context_hash: contextHash,
        expression_id: expressionId,
        feature_type_id,
        system_user_id: systemUserId ?? null
      },
      contextTtlSeconds
    );

    // Bound the context rows a caller can force by varying a search per mint. Enforced by eviction
    // rather than refusal, because a global refusal hands anyone a denial of service costing one
    // request per context. Evicting the context closest to expiry puts the cost on the least useful
    // session instead, and that caller re-mints on its next refresh. The new context is passed so it
    // can never be chosen as its own victim.
    const evicted = await this.martinContextRepository.enforceLiveContextCap(
      maxLiveContexts,
      created.martin_context_id
    );

    if (evicted) {
      defaultLog.warn({
        label: 'createOrReuseMartinContext',
        message: 'live tile context cap reached; evicted the contexts closest to expiry',
        evicted,
        max_live_contexts: maxLiveContexts
      });
    }

    defaultLog.info({
      label: 'createOrReuseMartinContext',
      message: 'created tile context',
      martin_context_id: created.martin_context_id,
      expression_id: expressionId
    });

    return {
      martinContextId: created.martin_context_id,
      expiresInSeconds: created.expires_in_seconds,
      hasMoreSecuredFeatures
    };
  }

  /**
   * Delete every expired tile context.
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
