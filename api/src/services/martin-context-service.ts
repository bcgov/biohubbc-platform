import { IDBConnection } from '../database/db';
import { ExpressionTree } from '../models/expression-tree';
import { MartinContextRepository } from '../repositories/martin-context-repository';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { optimizeExpression } from '../utils/expression-optimization';
import { getLogger } from '../utils/logger';
import { getMartinConfig } from '../utils/martin-config';
import { computeMartinContextHash } from '../utils/martin-context-hash';
import { DBService } from './db-service';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';
import { ExpressionTreeService } from './expression-tree-service';

const defaultLog = getLogger('services/martin-context-service');

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
  expressionTreeNormalizationService: ExpressionTreeNormalizationService;

  constructor(connection: IDBConnection) {
    super(connection);

    this.martinContextRepository = new MartinContextRepository(connection);
    this.searchFeatureRepository = new SearchFeatureRepository(connection);
    this.submissionRepository = new SubmissionRepository(connection);
    this.expressionTreeService = new ExpressionTreeService(connection);
    this.expressionTreeNormalizationService = new ExpressionTreeNormalizationService(connection);
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
    const { contextTtlSeconds, tokenTtlSeconds, maxLiveContexts } = getMartinConfig();

    // Resolved exactly as feature search resolves it, so an unknown feature type fails identically.
    const { feature_type_id } = await this.submissionRepository.getFeatureTypeIdByName(featureTypeName);

    // Validate once. Persistence retains the canonical normalized tree, while expression-driven
    // SQL consumes its optimized representation.
    const normalizedExpression = expressionTree
      ? await this.expressionTreeNormalizationService.normalize(expressionTree)
      : undefined;

    // Persisting (with reuse by semantic hash) is what gives the search a stable id the tile
    // function can evaluate at serve time. NULL means browse-all: no filtering beyond the feature
    // type and the caller's authorization.
    const expressionId = normalizedExpression
      ? (await this.expressionTreeService.writeNormalizedExpressionTree(normalizedExpression)).expression_id
      : null;
    const optimizedExpression = normalizedExpression ? optimizeExpression(normalizedExpression) : undefined;

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
      optimizedExpression,
      systemUserId
    );

    // Reuse and creation are one statement, serialized per context hash: two identical mints racing
    // here would otherwise both find nothing and both insert, and Martin would cache one search's
    // tiles twice.
    const context = await this.martinContextRepository.ensureLiveContext(
      {
        context_hash: contextHash,
        expression_id: expressionId,
        feature_type_id,
        system_user_id: systemUserId ?? null
      },
      tokenTtlSeconds,
      contextTtlSeconds
    );

    if (context.inserted) {
      // Bound the context rows a caller can force by varying a search per mint. Only a genuine
      // insert grows the table, so reuse never reaches this. Enforced by eviction rather than
      // refusal, because a global refusal hands anyone a denial of service costing one request per
      // context. Evicting the context closest to expiry puts the cost on the least useful session
      // instead, and that caller re-mints on its next refresh. The new context is passed so it can
      // never be chosen as its own victim.
      const evicted = await this.martinContextRepository.enforceLiveContextCap(
        maxLiveContexts,
        context.martin_context_id
      );

      if (evicted) {
        defaultLog.warn({
          label: 'createOrReuseMartinContext',
          message: 'live tile context cap reached; evicted the contexts closest to expiry',
          evicted,
          max_live_contexts: maxLiveContexts
        });
      }
    }

    // NOTE: log the expression id, never the expression itself.
    defaultLog.info({
      label: 'createOrReuseMartinContext',
      message: context.inserted ? 'created tile context' : 'reused tile context',
      martin_context_id: context.martin_context_id,
      expression_id: expressionId
    });

    return {
      martinContextId: context.martin_context_id,
      expiresInSeconds: context.expires_in_seconds,
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
