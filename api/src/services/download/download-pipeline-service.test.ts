import * as parquetjs from '@dsnp/parquetjs';
import chai, { expect } from 'chai';
import { Knex } from 'knex';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockDownloadVersionStatusRecord } from '../../__mocks__/download';
import { getKnex } from '../../database/db';
import { ApiConflictError, ApiGeneralError } from '../../errors/api-error';
import { DownloadSource } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { ExpressionTree } from '../../models/expression-tree';
import { NormalizedExpressionTree } from '../../models/expression-tree-internal';
import { FEATURE_PROPERTY_TYPE } from '../../models/feature-property';
import { FeatureTypeWithPropertyDefinitions } from '../../models/feature-type';
import { PolicyEffect } from '../../models/policy-statement';
import {
  ActivePolicyStatementWithExpression,
  PolicyStatementRepository
} from '../../repositories/authorization/policy-statement-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { dependencies as expressionEvaluation } from '../../repositories/expression-evaluation';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { PARQUET_PROPERTIES_METADATA_KEY } from '../../utils/parquet-utils';
import { CodeService } from '../code-service';
import { ExpressionTreeNormalizationService } from '../expression-tree-normalization-service';
import { ExpressionTreeService } from '../expression-tree-service';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { DownloadPipelineService } from './download-pipeline-service';

chai.use(sinonChai);

describe('DownloadPipelineService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('transitionDownloadVersionStatus', () => {
    // The transition now reads + writes the version DIRECTLY (status lives on the version), so the
    // lifecycle read is stubbed on DownloadVersionRepository.getDownloadVersion and the
    // write on updateDownloadVersionStatus; the first arg of both is the version id.
    const versionId = 'dddd0000-0000-0000-0000-000000000001';

    it('throws ApiConflictError when current status is not in allowedCurrentStatuses (illegal transition)', async () => {
      // Verifies: the state-machine assertion runs on the version's own status and rejects an illegal
      // transition (version is READY, only PROCESSING allowed) before any write.

      // Step 1: Stub the version-status read to return a READY (disallowed) version
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.READY }));
      const updateStub = sinon.stub(DownloadVersionRepository.prototype, 'updateDownloadVersionStatus').resolves();

      // Step 2: Attempt the illegal ready→processing transition
      try {
        await service.transitionDownloadVersionStatus(versionId, DownloadStatusEnum.PROCESSING, [
          DownloadStatusEnum.PROCESSING
        ]);
        expect.fail('expected throw');
      } catch (err: any) {
        // Step 3: Verify the conflict error surfaced
        expect(err).to.be.instanceOf(ApiConflictError);
        expect(err.message).to.equal('Invalid download status transition');
      }

      // Step 4: No write happened — the assertion fired before the update call
      expect(updateStub.called).to.be.false;
    });

    it('writes the version with started_at set for pending→processing', async () => {
      // Verifies: a pending→processing transition stamps started_at only, and the update is keyed by
      // the version id with the target status.

      // Step 1: Stub the version-status read to return a PENDING version
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.PENDING }));
      const updateStub = sinon.stub(DownloadVersionRepository.prototype, 'updateDownloadVersionStatus').resolves();

      // Step 2: Perform the transition
      await service.transitionDownloadVersionStatus(versionId, DownloadStatusEnum.PROCESSING, [
        DownloadStatusEnum.PENDING
      ]);

      // Step 3: Verify the params the service decided to pass to the repo
      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.equal(versionId);
      expect(updateStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      const metadata = updateStub.firstCall.args[2] as {
        started_at?: string;
        completed_at?: string;
        materialized_at?: string;
      };
      expect(metadata.started_at).to.be.a('string');
      expect(new Date(metadata.started_at!).toISOString()).to.equal(metadata.started_at);
      expect(metadata.completed_at).to.be.undefined;
      expect(metadata.materialized_at).to.be.undefined;
    });

    it('writes the version with completed_at and materialized_at set for processing→ready', async () => {
      // Verifies: a processing→ready transition stamps completed_at AND materialized_at (the data
      // watermark), but not started_at.

      // Step 1: Stub the version-status read to return a PROCESSING version
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon.stub(DownloadVersionRepository.prototype, 'updateDownloadVersionStatus').resolves();

      // Step 2: Perform the transition
      await service.transitionDownloadVersionStatus(versionId, DownloadStatusEnum.READY, [
        DownloadStatusEnum.PROCESSING
      ]);

      // Step 3: Verify the write is keyed by the version and the timestamp set is correct
      expect(updateStub.firstCall.args[0]).to.equal(versionId);
      expect(updateStub.firstCall.args[1]).to.equal(DownloadStatusEnum.READY);
      const metadata = updateStub.firstCall.args[2] as {
        started_at?: string;
        completed_at?: string;
        materialized_at?: string;
      };
      expect(metadata.started_at).to.be.undefined;
      expect(metadata.completed_at).to.be.a('string');
      // materialized_at is the data watermark, set only on a successful materialization.
      expect(metadata.materialized_at).to.be.a('string');
    });

    it('passes completed_at and error_message (no materialized_at) for processing→failed', async () => {
      // Verifies: a processing→failed transition stamps completed_at, re-keys errorMetadata.error →
      // error_message, and leaves materialized_at unset.

      // Step 1: Stub the version-status read to return a PROCESSING version
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon.stub(DownloadVersionRepository.prototype, 'updateDownloadVersionStatus').resolves();

      // Step 2: Perform the failing transition with error metadata
      await service.transitionDownloadVersionStatus(
        versionId,
        DownloadStatusEnum.FAILED,
        [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING],
        { error: 'job failed after all retries' }
      );

      // Step 3: Verify the write is keyed by the version and the failure metadata landed
      expect(updateStub.firstCall.args[0]).to.equal(versionId);
      expect(updateStub.firstCall.args[1]).to.equal(DownloadStatusEnum.FAILED);
      const metadata = updateStub.firstCall.args[2] as {
        error_message?: string;
        started_at?: string;
        completed_at?: string;
        materialized_at?: string;
      };
      expect(metadata.error_message).to.equal('job failed after all retries');
      expect(metadata.completed_at).to.be.a('string');
      expect(metadata.materialized_at).to.be.undefined;
    });

    it('maps featureCount to feature_count on processing→ready alongside the timestamps', async () => {
      // Verifies: the READY transition re-keys metadata.featureCount → the repo's feature_count
      // column while still stamping completed_at + materialized_at.

      // Step 1: Stub the version-status read to return a PROCESSING version
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon.stub(DownloadVersionRepository.prototype, 'updateDownloadVersionStatus').resolves();

      // Step 2: Perform the ready transition with the materialized feature count
      await service.transitionDownloadVersionStatus(
        versionId,
        DownloadStatusEnum.READY,
        [DownloadStatusEnum.PROCESSING],
        { featureCount: 42 }
      );

      // Step 3: Verify the count landed under the repo key and the timestamps are still set
      const metadata = updateStub.firstCall.args[2] as {
        completed_at?: string;
        materialized_at?: string;
        feature_count?: number;
      };
      expect(metadata.feature_count).to.equal(42);
      expect(metadata.completed_at).to.be.a('string');
      expect(metadata.materialized_at).to.be.a('string');
    });

    it('passes featureCount 0 through to the repo (strict undefined check, not truthiness)', async () => {
      // Verifies: a legitimate count of 0 (empty policy scope) is persisted — a truthiness
      // guard on featureCount would silently drop it.

      // Step 1: Stub the version-status read to return a PROCESSING version
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon.stub(DownloadVersionRepository.prototype, 'updateDownloadVersionStatus').resolves();

      // Step 2: Perform the ready transition with a zero count
      await service.transitionDownloadVersionStatus(
        versionId,
        DownloadStatusEnum.READY,
        [DownloadStatusEnum.PROCESSING],
        { featureCount: 0 }
      );

      // Step 3: Verify the zero landed (strictly) under the repo key
      const metadata = updateStub.firstCall.args[2] as { feature_count?: number };
      expect(metadata.feature_count).to.equal(0);
    });

    it('omits feature_count when featureCount is absent (FAILED transition with error only)', async () => {
      // Verifies: transitions that don't own the count (e.g. the DLQ's FAILED transition) leave
      // feature_count out of the update bag entirely, so the repo COALESCE preserves any stored value.

      // Step 1: Stub the version-status read to return a PROCESSING version
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon.stub(DownloadVersionRepository.prototype, 'updateDownloadVersionStatus').resolves();

      // Step 2: Perform the failing transition with error metadata only
      await service.transitionDownloadVersionStatus(
        versionId,
        DownloadStatusEnum.FAILED,
        [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING],
        { error: 'job failed after all retries' }
      );

      // Step 3: Verify no feature_count key was passed
      const metadata = updateStub.firstCall.args[2] as { error_message?: string; feature_count?: number };
      expect(metadata.error_message).to.equal('job failed after all retries');
      expect(metadata.feature_count).to.be.undefined;
    });
  });

  // -------------------------------------------------------------------------
  // Parquet pipeline methods
  // -------------------------------------------------------------------------

  // Shared test data for Parquet tests
  const TEST_DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000042';
  const TEST_DOWNLOAD_VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';
  const TEST_FEATURE_IDS = Buffer.from('feature-type-bitmap');
  const TEST_POLICY_ID = '11111111-1111-1111-1111-111111111111';
  const TEST_SOURCE: DownloadSource = { policy_id: TEST_POLICY_ID, requested_by: 7 };

  const stmt = (
    urn_feature_type: string,
    expression_id: string | null = null,
    effect: PolicyEffect = PolicyEffect.ALLOW
  ): ActivePolicyStatementWithExpression => ({
    policy_statement_id: '22222222-2222-2222-2222-222222222222',
    effect,
    urn_feature_type,
    expression_id
  });

  describe('resolveParquetSchema', () => {
    const mockCodes: FeatureTypeWithPropertyDefinitions[] = [
      {
        feature_type: { feature_type_id: 1, name: 'survey', display_name: 'Survey', description: null },
        properties: [
          {
            feature_property_id: 1,
            name: 'title',
            display_name: 'Title',
            description: 'Title',
            type_name: FEATURE_PROPERTY_TYPE.STRING,
            calculated_value: false
          }
        ]
      },
      {
        feature_type: {
          feature_type_id: 2,
          name: 'observation',
          display_name: 'Observation',
          description: null
        },
        properties: [
          {
            feature_property_id: 2,
            name: 'species',
            display_name: 'Species',
            description: 'Species',
            type_name: FEATURE_PROPERTY_TYPE.STRING,
            calculated_value: false
          }
        ]
      }
    ];

    it('returns featureTypes from active policy statements alongside the schema lookup', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypeProperties').resolves(mockCodes);
      const statements = [stmt('survey'), stmt('observation', '33333333-3333-3333-3333-333333333333')];
      sinon
        .stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId')
        .resolves(statements);

      const result = await service.resolveParquetSchema(TEST_SOURCE);

      expect(result.featureTypes).to.deep.equal(['survey', 'observation']);
      expect(result.statements).to.deep.equal(statements);
      expect(result.schemaLookup.has('survey')).to.be.true;
      expect(result.schemaLookup.has('observation')).to.be.true;
    });

    it('preserves the SQL ORDER BY urn_feature_type ordering of statements', async () => {
      // Repo layer is the source of ordering; service preserves whatever order it gets.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypeProperties').resolves(mockCodes);
      // Repo returns rows in urn_feature_type ASC; service must not reorder them.
      const statements = [stmt('a'), stmt('b'), stmt('c')];
      sinon
        .stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId')
        .resolves(statements);

      const result = await service.resolveParquetSchema(TEST_SOURCE);

      expect(result.featureTypes).to.deep.equal(['a', 'b', 'c']);
    });

    it('expands wildcard statements into concrete sorted feature type statements', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypeProperties').resolves([...mockCodes].reverse());
      const wildcardStatement = stmt('*', '33333333-3333-3333-3333-333333333333');
      sinon
        .stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId')
        .resolves([wildcardStatement]);

      const result = await service.resolveParquetSchema(TEST_SOURCE);

      expect(result.featureTypes).to.deep.equal(['observation', 'survey']);
      expect(result.statements).to.deep.equal([
        { ...wildcardStatement, urn_feature_type: 'observation' },
        { ...wildcardStatement, urn_feature_type: 'survey' }
      ]);
    });

    it('uses a broad allow wildcard instead of evaluating narrower statements', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypeProperties').resolves(mockCodes);
      const wildcardStatement = stmt('*', null);
      const concreteStatement = stmt('survey', '33333333-3333-3333-3333-333333333333');
      sinon
        .stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId')
        .resolves([wildcardStatement, concreteStatement]);

      const result = await service.resolveParquetSchema(TEST_SOURCE);

      expect(result.featureTypes).to.deep.equal(['observation', 'survey']);
      expect(result.statements).to.deep.equal([
        { ...wildcardStatement, urn_feature_type: 'observation' },
        { ...wildcardStatement, urn_feature_type: 'survey' }
      ]);
    });

    it('combines filtered wildcard and concrete allow statements for the same feature type', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypeProperties').resolves(mockCodes);
      const wildcardStatement = stmt('*', '33333333-3333-3333-3333-333333333333');
      const observationStatement = stmt('observation', '44444444-4444-4444-4444-444444444444');
      sinon
        .stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId')
        .resolves([wildcardStatement, observationStatement]);

      const result = await service.resolveParquetSchema(TEST_SOURCE);

      expect(result.featureTypes).to.deep.equal(['observation', 'survey']);
      expect(result.statements).to.deep.equal([
        {
          ...wildcardStatement,
          urn_feature_type: 'observation',
          expression_ids: ['33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444']
        },
        { ...wildcardStatement, urn_feature_type: 'survey' }
      ]);
    });

    it('ignores deny statements and lets broad concrete allow statements dominate filtered statements', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypeProperties').resolves(mockCodes);
      const surveyAllow = stmt('survey');
      const repeatedSurveyAllow = stmt('survey', '33333333-3333-3333-3333-333333333333');
      sinon
        .stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId')
        .resolves([stmt('observation', null, PolicyEffect.DENY), surveyAllow, repeatedSurveyAllow]);

      const result = await service.resolveParquetSchema(TEST_SOURCE);

      expect(result.featureTypes).to.deep.equal(['survey']);
      expect(result.statements).to.deep.equal([surveyAllow]);
    });

    it('returns empty featureTypes and statements for a policy with no active statements', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypeProperties').resolves(mockCodes);
      sinon.stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId').resolves([]);

      const result = await service.resolveParquetSchema(TEST_SOURCE);

      expect(result.featureTypes).to.deep.equal([]);
      expect(result.statements).to.deep.equal([]);
    });
  });

  // A subquery stub that exposes toSQL() — the only surface the service uses on
  // the returned Knex.QueryBuilder.
  const subqueryStub = (sql = 'SELECT 1', bindings: unknown[] = []) =>
    ({
      toSQL: () => ({ sql, bindings })
    } as unknown as Knex.QueryBuilder);

  describe('buildDownloadFeatureIdsQuery', () => {
    const mockTree = { type: 'expression', operator: 'AND', clauses: [] } as unknown as ExpressionTree;
    const normalizedTree = {
      type: 'expression',
      operator: 'AND',
      clauses: []
    } as unknown as NormalizedExpressionTree;

    it('returns null without building a subquery when there are no statements', async () => {
      // Verifies: an empty statement list short-circuits to null (the caller stores the empty set)
      const service = new DownloadPipelineService(getMockDBConnection());
      const buildBroadStub = sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery');
      const buildExprSubqueryStub = sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');

      const result = await service.buildDownloadFeatureIdsQuery(TEST_SOURCE, []);

      expect(result).to.equal(null);
      expect(buildBroadStub).to.not.have.been.called;
      expect(buildExprSubqueryStub).to.not.have.been.called;
    });

    it('uses the expression-tree path when statement.expression_id is set', async () => {
      // Verifies: a filtered statement is read, normalized and compiled through the expression builder

      // Step 1: Stub the expression read, normalization and the two subquery builders
      const service = new DownloadPipelineService(getMockDBConnection());
      const readTreeStub = sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(mockTree);
      const validateStub = sinon
        .stub(ExpressionTreeNormalizationService.prototype, 'normalize')
        .resolves(normalizedTree);
      const buildExprSubqueryStub = sinon
        .stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery')
        .returns(subqueryStub('SELECT expression', ['observation']));
      const buildBroadStub = sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery');

      const expressionId = '44444444-4444-4444-4444-444444444444';

      // Step 2: Build the query for one filtered statement
      const result = await service.buildDownloadFeatureIdsQuery(TEST_SOURCE, [stmt('observation', expressionId)]);

      // Step 3: The expression path ran for the statement's feature type and requesting user
      expect(readTreeStub).to.have.been.calledOnceWith(expressionId);
      expect(validateStub).to.have.been.calledOnceWith(mockTree);
      expect(buildExprSubqueryStub).to.have.been.calledOnceWith(
        'observation',
        normalizedTree,
        TEST_SOURCE.requested_by
      );
      expect(buildBroadStub).to.not.have.been.called;

      // Step 4: A single subquery is returned compiled, as is
      expect(result).to.deep.equal({ sql: 'SELECT expression', bindings: ['observation'] });
    });

    it('unions multiple expression ids for one effective feature-type statement', async () => {
      // Verifies: several filtered ALLOWs for one type are combined with UNION (not UNION ALL)

      // Step 1: Stub the expression read and return a real subquery per expression
      const service = new DownloadPipelineService(getMockDBConnection());
      const readTreeStub = sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(mockTree);
      sinon.stub(ExpressionTreeNormalizationService.prototype, 'normalize').resolves(normalizedTree);

      const knex = getKnex();
      const buildExprSubqueryStub = sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');
      buildExprSubqueryStub.onCall(0).returns(knex.select(knex.raw('?::int as submission_feature_id', [1])));
      buildExprSubqueryStub.onCall(1).returns(knex.select(knex.raw('?::int as submission_feature_id', [2])));
      const buildBroadStub = sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery');

      const expressionIds = ['44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555'];

      // Step 2: Build the query for one statement that carries both expression ids
      const result = await service.buildDownloadFeatureIdsQuery(TEST_SOURCE, [
        { ...stmt('observation', expressionIds[0]), expression_ids: expressionIds }
      ]);

      // Step 3: Each expression was read and compiled, and the two are UNIONed
      expect(readTreeStub.getCalls().map((call) => call.args[0])).to.deep.equal(expressionIds);
      expect(buildExprSubqueryStub).to.have.been.calledTwice;
      expect(buildBroadStub).to.not.have.been.called;
      expect(result?.sql).to.contain('union');
      expect(result?.sql).to.not.contain('union all');
      expect(result?.bindings).to.deep.equal([1, 2]);
    });

    it('uses the broad path when statement.expression_id is null', async () => {
      // Verifies: an unfiltered statement selects the whole feature type without reading an expression
      const service = new DownloadPipelineService(getMockDBConnection());
      const readTreeStub = sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree');
      const buildExprSubqueryStub = sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');
      const buildBroadStub = sinon
        .stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));

      const result = await service.buildDownloadFeatureIdsQuery(TEST_SOURCE, [stmt('observation', null)]);

      expect(readTreeStub).to.not.have.been.called;
      expect(buildExprSubqueryStub).to.not.have.been.called;
      expect(buildBroadStub).to.have.been.calledOnceWith('observation', TEST_SOURCE.requested_by);
      expect(result).to.deep.equal({ sql: 'SELECT broad', bindings: [] });
    });

    it('passes source.requested_by (the requesting user) — NOT the worker identity — through to the security filter', async () => {
      // Verifies: visibility is judged for the download's requesting user
      const service = new DownloadPipelineService(getMockDBConnection());
      const buildBroadStub = sinon
        .stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));

      const requestingUserId = 999;
      const sourceWithRequester: DownloadSource = { policy_id: TEST_POLICY_ID, requested_by: requestingUserId };

      await service.buildDownloadFeatureIdsQuery(sourceWithRequester, [stmt('observation', null)]);

      expect(buildBroadStub).to.have.been.calledOnceWith('observation', requestingUserId);
    });

    it('combines the statements of several feature types with UNION ALL, keeping their bindings in order', async () => {
      // Verifies: one subquery per statement, disjoint by feature type, combined without a dedup pass

      // Step 1: Return a real subquery per feature type
      const service = new DownloadPipelineService(getMockDBConnection());
      const knex = getKnex();
      const buildBroadStub = sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery');
      buildBroadStub.onCall(0).returns(knex.select(knex.raw('?::int as submission_feature_id', [1])));
      buildBroadStub.onCall(1).returns(knex.select(knex.raw('?::int as submission_feature_id', [2])));

      // Step 2: Build the query for two unfiltered statements
      const result = await service.buildDownloadFeatureIdsQuery(TEST_SOURCE, [
        stmt('observation', null),
        stmt('survey', null)
      ]);

      // Step 3: Each statement's own feature type was compiled for the requesting user
      expect(buildBroadStub.getCalls().map((call) => call.args)).to.deep.equal([
        ['observation', TEST_SOURCE.requested_by],
        ['survey', TEST_SOURCE.requested_by]
      ]);

      // Step 4: The two are combined with UNION ALL and the bindings follow statement order
      expect(result?.sql).to.contain('union all');
      expect(result?.bindings).to.deep.equal([1, 2]);
    });

    it('nests the UNION of a multi-expression statement inside the UNION ALL with a broad statement', async () => {
      // Verifies: a broad statement and a statement with two expressions compile to
      // (broad) UNION ALL ((expression 1) UNION (expression 2)), with bindings in that order

      // Step 1: Return a real subquery for the broad type and for each expression
      const service = new DownloadPipelineService(getMockDBConnection());
      sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(mockTree);
      sinon.stub(ExpressionTreeNormalizationService.prototype, 'normalize').resolves(normalizedTree);

      const knex = getKnex();
      const buildBroadStub = sinon
        .stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery')
        .returns(knex.select(knex.raw('?::int as broad_id', [10])));
      const buildExprSubqueryStub = sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');
      buildExprSubqueryStub.onCall(0).returns(knex.select(knex.raw('?::int as first_expression_id', [20])));
      buildExprSubqueryStub.onCall(1).returns(knex.select(knex.raw('?::int as second_expression_id', [30])));

      const expressionIds = ['44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555'];

      // Step 2: Build the query for a broad statement followed by a two-expression statement
      const result = await service.buildDownloadFeatureIdsQuery(TEST_SOURCE, [
        stmt('survey', null),
        { ...stmt('observation', expressionIds[0]), expression_ids: expressionIds }
      ]);

      // Step 3: Each builder was called for its own statement's feature type
      expect(buildBroadStub).to.have.been.calledOnceWith('survey', TEST_SOURCE.requested_by);
      expect(buildExprSubqueryStub.getCalls().map((call) => call.args[0])).to.deep.equal([
        'observation',
        'observation'
      ]);

      // Step 4: The expression UNION is one parenthesised operand of the UNION ALL
      expect(result?.sql).to.equal(
        '(select ?::int as broad_id) union all ' +
          '((select ?::int as first_expression_id) union (select ?::int as second_expression_id))'
      );

      // Step 5: The bindings follow the SQL: the broad statement's, then each expression's
      expect(result?.bindings).to.deep.equal([10, 20, 30]);
    });

    it('returns knex placeholder SQL that keeps a literal question mark escaped', async () => {
      // Verifies: the SQL is handed on uncompiled (`?` placeholders, `\\?` for a literal question
      // mark such as a jsonb operator), so embedding it in knex.raw binds the right values

      // Step 1: Return a real subquery whose SQL holds a literal `?` operator and one binding
      const service = new DownloadPipelineService(getMockDBConnection());
      const knex = getKnex();
      sinon
        .stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery')
        .returns(knex.select('submission_feature_id').from('submission_feature').whereRaw('data \\? ?', ['key']));

      // Step 2: Build the query
      const result = await service.buildDownloadFeatureIdsQuery(TEST_SOURCE, [stmt('observation', null)]);

      // Step 3: The placeholder stays `?` and the operator stays escaped
      expect(result?.sql).to.equal('select "submission_feature_id" from "submission_feature" where data \\? ?');
      expect(result?.bindings).to.deep.equal(['key']);

      // Step 4: Embedded in a raw statement with one more binding, the operator comes out as a plain
      // `?` and the two bindings take positions 1 and 2
      const compiled = knex.raw(`SELECT 1 FROM (${result?.sql}) ids LIMIT ?`, [...(result?.bindings ?? []), 5]);
      expect(compiled.toSQL().toNative()).to.deep.equal({
        sql: 'SELECT 1 FROM (select "submission_feature_id" from "submission_feature" where data ? $1) ids LIMIT $2',
        bindings: ['key', 5]
      });
    });
  });

  describe('listDownloadVersionFileFeatureSets', () => {
    it('returns one entry per feature type of the given types and the stored set, sorted, each with its ids', async () => {
      // Verifies: a type only in the stored set is added, a type in both appears once with its
      // bitmap, a type with a statement and no stored feature gets null ids, and the result is
      // ordered by name whatever order the inputs came in

      // Step 1: The stored set holds 'survey' and 'capture' features
      const service = new DownloadPipelineService(getMockDBConnection());
      const captureIds = Buffer.from('capture-bitmap');
      const surveyIds = Buffer.from('survey-bitmap');
      const listStub = sinon.stub(DownloadVersionRepository.prototype, 'listDownloadVersionFeatureIdsByType').resolves([
        { name: 'survey', feature_ids: surveyIds },
        { name: 'capture', feature_ids: captureIds }
      ]);

      // Step 2: The resolved statements cover 'survey' and 'observation'
      const result = await service.listDownloadVersionFileFeatureSets(TEST_DOWNLOAD_VERSION_ID, [
        'survey',
        'observation'
      ]);

      // Step 3: The stored set is read once for the version, and the union is sorted and de-duplicated
      expect(listStub).to.have.been.calledOnceWithExactly(TEST_DOWNLOAD_VERSION_ID);
      expect(result).to.deep.equal([
        { featureTypeName: 'capture', featureIds: captureIds },
        { featureTypeName: 'observation', featureIds: null },
        { featureTypeName: 'survey', featureIds: surveyIds }
      ]);
    });

    it('keeps a feature type that has a statement but no feature in the stored set', async () => {
      // Verifies: an empty stored set does not drop the statements' types (they get an empty file)
      const service = new DownloadPipelineService(getMockDBConnection());
      sinon.stub(DownloadVersionRepository.prototype, 'listDownloadVersionFeatureIdsByType').resolves([]);

      const result = await service.listDownloadVersionFileFeatureSets(TEST_DOWNLOAD_VERSION_ID, ['survey']);

      expect(result).to.deep.equal([{ featureTypeName: 'survey', featureIds: null }]);
    });
  });

  describe('storeDownloadVersionFeatureSet', () => {
    it('stores the compiled feature-id query on the version, then returns the stored set size', async () => {
      // Verifies: the compiled SQL and bindings go to the store, and the returned count is read back
      // from the stored set after the store

      // Step 1: Stub the subquery builder and the two repository calls
      const service = new DownloadPipelineService(getMockDBConnection());
      sinon
        .stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad WHERE type = ?', ['observation']));
      const updateStub = sinon.stub(DownloadVersionRepository.prototype, 'updateDownloadVersionFeatureIds').resolves();
      const sizeStub = sinon
        .stub(DownloadVersionRepository.prototype, 'findDownloadVersionFeatureSetSize')
        .resolves(12);

      // Step 2: Store the set
      const result = await service.storeDownloadVersionFeatureSet({
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        statements: [stmt('observation', null)]
      });

      // Step 3: The store received the version, the compiled SQL and its bindings
      expect(updateStub).to.have.been.calledOnceWithExactly(TEST_DOWNLOAD_VERSION_ID, 'SELECT broad WHERE type = ?', [
        'observation'
      ]);

      // Step 4: The size is read for the same version, after the store
      expect(sizeStub).to.have.been.calledOnceWithExactly(TEST_DOWNLOAD_VERSION_ID);
      expect(sizeStub).to.have.been.calledAfter(updateStub);
      expect(result).to.equal(12);
    });

    it('stores the empty set (null query, no bindings) when the download has no statements', async () => {
      // Verifies: no statements still stores a set, so the version records "built, empty"
      const service = new DownloadPipelineService(getMockDBConnection());
      const updateStub = sinon.stub(DownloadVersionRepository.prototype, 'updateDownloadVersionFeatureIds').resolves();
      sinon.stub(DownloadVersionRepository.prototype, 'findDownloadVersionFeatureSetSize').resolves(0);

      const result = await service.storeDownloadVersionFeatureSet({
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        statements: []
      });

      expect(updateStub).to.have.been.calledOnceWithExactly(TEST_DOWNLOAD_VERSION_ID, null, []);
      expect(result).to.equal(0);
    });

    it('throws ApiGeneralError naming the version when no set is stored after the update', async () => {
      // Verifies: a version with no stored set after the store is a broken invariant, not a count of 0
      const service = new DownloadPipelineService(getMockDBConnection());
      sinon.stub(DownloadVersionRepository.prototype, 'updateDownloadVersionFeatureIds').resolves();
      sinon.stub(DownloadVersionRepository.prototype, 'findDownloadVersionFeatureSetSize').resolves(null);

      try {
        await service.storeDownloadVersionFeatureSet({
          downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
          source: TEST_SOURCE,
          statements: []
        });
        expect.fail('Expected error');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiGeneralError);
        expect((error as ApiGeneralError).message).to.equal('Download version has no stored feature set');
        expect((error as ApiGeneralError).errors).to.deep.include({ downloadVersionId: TEST_DOWNLOAD_VERSION_ID });
      }
    });
  });

  describe('writeFeatureTypeParquet', () => {
    const mockProperties: CsvPropertyDefinition[] = [
      { feature_property_name: 'species', feature_property_type_name: 'string' }
    ];

    const mockSpatialProperties: CsvPropertyDefinition[] = [
      { feature_property_name: 'species', feature_property_type_name: 'string' },
      { feature_property_name: 'location', feature_property_type_name: 'spatial' }
    ];

    // Helper: mock async generator for base feature cursor
    async function* mockBaseCursor(batches: any[][]): AsyncGenerator<any[]> {
      for (const batch of batches) {
        yield batch;
      }
    }

    // Stubs all downstream effects used by every writeFeatureTypeParquet test so
    // each test only asserts the behavior it cares about.
    const stubParquetPipeline = () => {
      const mockWriter = {
        appendRow: sinon.stub().resolves(),
        close: sinon.stub().resolves(),
        setMetadata: sinon.stub()
      };
      const openStreamStub = sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(mockWriter as any);
      const uploadStub = sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();
      const insertArtifactStub = sinon
        .stub(ArtifactService.prototype, 'insertArtifact')
        .resolves({ artifact_id: 'bbbb0000-0000-0000-0000-000000000001' } as any);
      const linkStub = sinon.stub(DownloadVersionRepository.prototype, 'createDownloadVersionArtifact').resolves();
      return { mockWriter, openStreamStub, uploadStub, insertArtifactStub, linkStub };
    };

    it('opens the cursor on the feature type part of the stored feature set, without evaluating the policy', async () => {
      // Verifies: the rows come from the ids the caller passes for this feature type; the writer builds no
      // feature-id subquery

      // Step 1: Stub the pipeline, the cursor and the subquery builders
      const service = new DownloadPipelineService(getMockDBConnection());
      stubParquetPipeline();
      const streamStub = sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds')
        .returns(mockBaseCursor([]));
      const readTreeStub = sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree');
      const buildExprSubqueryStub = sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');
      const buildBroadStub = sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery');

      // Step 2: Write one feature type
      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        properties: mockProperties,
        featureTypeName: 'observation',
        featureIds: TEST_FEATURE_IDS
      });

      // Step 3: The cursor is named by the download and the type, and reads the type's ids
      expect(streamStub).to.have.been.calledOnceWithExactly(TEST_DOWNLOAD_ID, 'observation', TEST_FEATURE_IDS);

      // Step 4: Nothing was evaluated
      expect(readTreeStub).to.not.have.been.called;
      expect(buildExprSubqueryStub).to.not.have.been.called;
      expect(buildBroadStub).to.not.have.been.called;
    });

    it('streams features through the writer and uploads with deterministic S3 key', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter, uploadStub } = stubParquetPipeline();

      const baseBatch = [
        {
          submission_feature_id: 1,
          uuid: 'uuid-1',
          feature_type_name: 'observation',
          data: { properties: {} },
          parent_uuid: null
        }
      ];
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds').returns(mockBaseCursor([baseBatch]));
      sinon
        .stub(DownloadRepository.prototype, 'fetchTypedPropertyRows')
        .resolves([{ submission_feature_id: 1, name: 'species', value: 'moose' }]);

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        properties: mockProperties,
        featureTypeName: 'observation',
        featureIds: TEST_FEATURE_IDS
      });

      expect(mockWriter.appendRow).to.have.been.calledOnce;
      expect(mockWriter.close).to.have.been.calledOnce;
      expect(uploadStub).to.have.been.calledOnce;
      expect(uploadStub.firstCall.args[3]).to.equal(
        `downloads/${TEST_DOWNLOAD_ID}/versions/${TEST_DOWNLOAD_VERSION_ID}/observation/data.parquet`
      );
    });

    it('sets GeoParquet metadata on the writer when feature type has spatial properties', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        properties: mockSpatialProperties,
        featureTypeName: 'observation',
        featureIds: TEST_FEATURE_IDS
      });

      expect(mockWriter.setMetadata).to.have.been.calledTwice;
      expect(mockWriter.setMetadata.firstCall.args[0]).to.equal('geo');
      expect(mockWriter.setMetadata.firstCall.args[1]).to.be.a('string');
      expect(mockWriter.setMetadata.secondCall.args[0]).to.equal(PARQUET_PROPERTIES_METADATA_KEY);
    });

    it('stores the property list the file was built with, and no GeoParquet entry, when there are no spatial properties', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        properties: mockProperties,
        featureTypeName: 'observation',
        featureIds: TEST_FEATURE_IDS
      });

      expect(mockWriter.setMetadata).to.have.been.calledOnce;
      expect(mockWriter.setMetadata.firstCall.args[0]).to.equal(PARQUET_PROPERTIES_METADATA_KEY);
      expect(JSON.parse(mockWriter.setMetadata.firstCall.args[1])).to.deep.equal(mockProperties);
    });

    it('inserts artifact with uploaded status, parquet format, and the deterministic S3 key', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { insertArtifactStub } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        properties: mockProperties,
        featureTypeName: 'observation',
        featureIds: TEST_FEATURE_IDS
      });

      expect(insertArtifactStub).to.have.been.calledOnce;
      const payload = insertArtifactStub.firstCall.args[0];
      expect(payload.artifact_status).to.equal('uploaded');
      expect(payload.format).to.equal('parquet');
      expect(payload.object_key).to.equal(
        `downloads/${TEST_DOWNLOAD_ID}/versions/${TEST_DOWNLOAD_VERSION_ID}/observation/data.parquet`
      );
    });

    it('aborts the multipart upload and surfaces the original error when row hydration throws mid-stream', async () => {
      // Regression test for the stream-lifecycle gap Codex flagged: a throw inside the
      // cursor → hydrate → appendRow loop must rethrow the original error AND tear
      // down the in-flight upload, not leave it hanging or surface as an unhandled
      // rejection. Here the upload stub rejects with an upload-side error to
      // simulate an S3 abort propagating back through `uploadPromise`; the original
      // hydration error must still be the one thrown to the caller.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const mockWriter = {
        appendRow: sinon.stub().resolves(),
        close: sinon.stub().resolves(),
        setMetadata: sinon.stub()
      };
      sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(mockWriter as any);

      // Upload that immediately rejects to simulate an S3 multipart abort cascading
      // back into the await — the catch in writeFeatureTypeParquet must swallow this
      // so the original `hydrateError` is what surfaces.
      const uploadStub = sinon
        .stub(ObjectStorageService.prototype, 'uploadStream')
        .rejects(new Error('S3 upload aborted by caller'));

      sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds')
        .returns(mockBaseCursor([[{ submission_feature_id: 1 }]]));
      const hydrateError = new Error('hydration blew up');
      sinon.stub(DownloadPipelineService.prototype, 'hydrateFeatureBatch').rejects(hydrateError);

      let caught: unknown;
      try {
        await service.writeFeatureTypeParquet({
          downloadId: TEST_DOWNLOAD_ID,
          downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
          properties: mockProperties,
          featureTypeName: 'observation',
          featureIds: TEST_FEATURE_IDS
        });
      } catch (e) {
        caught = e;
      }

      // Original error wins; upload-abort rejection is swallowed.
      expect(caught).to.equal(hydrateError);
      expect(uploadStub).to.have.been.calledOnce;
    });

    it('does NOT deadlock when the upload promise never settles after a hydrate error (sticky-upload guard)', async () => {
      // Real S3 multipart uploads can swallow `passThrough.destroy(...)` and
      // leave `uploadPromise` pending indefinitely if the SDK has buffered bytes
      // mid-flight. Without the bounded race in finally, the worker hangs in the
      // try/finally → withConnection never rolls back → connection state is stuck
      // in "idle in transaction (aborted)" → pg-boss never sees a terminal state.
      // This test pins that the cleanup completes in bounded time even when the
      // upload promise is permanently pending.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const mockWriter = {
        appendRow: sinon.stub().resolves(),
        close: sinon.stub().resolves(),
        setMetadata: sinon.stub()
      };
      sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(mockWriter as any);

      // Upload that never settles — simulates the sticky-multipart-upload case.
      const uploadStub = sinon
        .stub(ObjectStorageService.prototype, 'uploadStream')
        .returns(new Promise<void>(() => undefined));

      sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds')
        .returns(mockBaseCursor([[{ submission_feature_id: 1 }]]));
      const hydrateError = new Error('hydration blew up');
      sinon.stub(DownloadPipelineService.prototype, 'hydrateFeatureBatch').rejects(hydrateError);

      // Cap the test at well below the cleanup race deadline (5s) plus a safety
      // margin — the assertion is "the call returns within bounded time", not
      // "the call returns instantly".
      const start = Date.now();
      let caught: unknown;
      try {
        await service.writeFeatureTypeParquet({
          downloadId: TEST_DOWNLOAD_ID,
          downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
          properties: mockProperties,
          featureTypeName: 'observation',
          featureIds: TEST_FEATURE_IDS
        });
      } catch (e) {
        caught = e;
      }
      const elapsed = Date.now() - start;

      expect(caught).to.equal(hydrateError);
      expect(uploadStub).to.have.been.calledOnce;
      // Cleanup race deadline is 5s; allow 2s margin for slow CI.
      expect(elapsed).to.be.lessThan(7000);
    }).timeout(8000);

    it('aborts the multipart upload when ParquetWriter setup throws AFTER upload startup', async () => {
      // Pre-loop throw point regression (Codex re-eval): ParquetWriter.openStream
      // runs after uploadPromise has been created but inside the try block. The
      // catch must still tear down the upload; without the fix this would leak the
      // S3 multipart context.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const writerError = new Error('parquet writer init failed');
      sinon.stub(parquetjs.ParquetWriter, 'openStream').rejects(writerError);

      const uploadStub = sinon
        .stub(ObjectStorageService.prototype, 'uploadStream')
        .rejects(new Error('S3 upload aborted by caller'));

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds').returns(mockBaseCursor([]));

      let caught: unknown;
      try {
        await service.writeFeatureTypeParquet({
          downloadId: TEST_DOWNLOAD_ID,
          downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
          properties: mockProperties,
          featureTypeName: 'observation',
          featureIds: TEST_FEATURE_IDS
        });
      } catch (e) {
        caught = e;
      }

      // The original writer-init error wins; upload-abort rejection is swallowed.
      expect(caught).to.equal(writerError);
      expect(uploadStub).to.have.been.calledOnce;
    });

    it('links the artifact to the download version (not the download) after the artifact row is created', async () => {
      // Verifies: the produced artifact is linked via createDownloadVersionArtifact against the
      // version id — keyed by feature type — and that the link write happens after the artifact
      // row exists (the FK requires the artifact first).
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { insertArtifactStub, linkStub } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        properties: mockProperties,
        featureTypeName: 'observation',
        featureIds: TEST_FEATURE_IDS
      });

      expect(insertArtifactStub).to.have.been.calledOnce;
      expect(linkStub).to.have.been.calledOnce;
      // (downloadVersionId, artifact_id, featureTypeName) — version-keyed, not download-keyed.
      expect(linkStub.firstCall.args[0]).to.equal(TEST_DOWNLOAD_VERSION_ID);
      expect(linkStub.firstCall.args[1]).to.equal('bbbb0000-0000-0000-0000-000000000001');
      expect(linkStub.firstCall.args[2]).to.equal('observation');
      expect(linkStub).to.have.been.calledAfter(insertArtifactStub);
    });

    // Minimal hydrated feature for the row-count tests — shape matches what
    // hydrateFeatureBatch assembles (ParquetFeatureData).
    const hydratedFeature = (id: number) => ({
      submission_feature_id: id,
      uuid: `uuid-${id}`,
      feature_type_name: 'observation',
      data: { species: 'moose' },
      parent_uuid: null
    });

    it('returns the accumulated hydrated row count across cursor batches', async () => {
      // Verifies: the count is accumulated during the streaming write (2 batches → 2 + 1
      // hydrated rows → 3) so the caller can persist the version's total at materialization
      // time instead of computing a live COUNT later.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds')
        .returns(
          mockBaseCursor([[{ submission_feature_id: 1 }, { submission_feature_id: 2 }], [{ submission_feature_id: 3 }]])
        );

      const hydrateStub = sinon.stub(DownloadPipelineService.prototype, 'hydrateFeatureBatch');
      hydrateStub.onCall(0).resolves([hydratedFeature(1), hydratedFeature(2)]);
      hydrateStub.onCall(1).resolves([hydratedFeature(3)]);

      const result = await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        properties: mockProperties,
        featureTypeName: 'observation',
        featureIds: TEST_FEATURE_IDS
      });

      expect(result).to.equal(3);
      expect(mockWriter.appendRow).to.have.been.calledThrice;
    });

    it('counts HYDRATED rows, not base cursor rows', async () => {
      // Verifies: the count reflects what actually lands in the Parquet file — the hydrated
      // rows written through appendRow — not the raw base cursor batch size.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      // Base batch has 3 rows...
      sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds')
        .returns(
          mockBaseCursor([[{ submission_feature_id: 1 }, { submission_feature_id: 2 }, { submission_feature_id: 3 }]])
        );
      // ...but hydration resolves only 2.
      sinon
        .stub(DownloadPipelineService.prototype, 'hydrateFeatureBatch')
        .resolves([hydratedFeature(1), hydratedFeature(2)]);

      const result = await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        properties: mockProperties,
        featureTypeName: 'observation',
        featureIds: TEST_FEATURE_IDS
      });

      expect(result).to.equal(2);
      expect(mockWriter.appendRow).to.have.been.calledTwice;
    });

    it('returns 0 (not undefined/NaN) for an empty cursor', async () => {
      // Verifies: a feature type with no visible rows still reports an explicit numeric 0 so
      // the caller's sum stays a number.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByFeatureIds').returns(mockBaseCursor([]));

      const result = await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        properties: mockProperties,
        featureTypeName: 'observation',
        featureIds: TEST_FEATURE_IDS
      });

      expect(result).to.equal(0);
      expect(mockWriter.appendRow).to.not.have.been.called;
    });
  });

  describe('service shape', () => {
    it('does not expose searchFeatureService (Phase 2 carved that import out of the pipeline)', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      // Cast to any so the assertion documents intent rather than relying on TS narrowing
      expect((service as any).searchFeatureService).to.be.undefined;
    });
  });
});
