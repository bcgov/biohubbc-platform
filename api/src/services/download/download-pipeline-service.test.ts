import * as parquetjs from '@dsnp/parquetjs';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockDownloadVersionStatusRecord } from '../../__mocks__/download';
import { getKnex } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { DownloadSource } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { ExpressionTree } from '../../models/expression-tree';
import { NormalizedExpressionTreeExpression } from '../../models/expression-tree-internal';
import { FEATURE_PROPERTY_TYPE } from '../../models/feature-property';
import { FeatureTypeWithProperties } from '../../models/feature-type';
import { PolicyEffect } from '../../models/policy-statement';
import {
  ActivePolicyStatementWithExpression,
  PolicyStatementRepository
} from '../../repositories/authorization/policy-statement-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { dependencies as expressionEvaluation } from '../../repositories/expression-evaluation';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { CodeService } from '../code-service';
import { ExpressionPredicateSemanticValidator } from '../expression-predicate-semantic-validator';
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
    // lifecycle read is stubbed on DownloadVersionRepository.getDownloadVersionStatusById and the
    // write on updateDownloadVersionStatus; the first arg of both is the version id.
    const versionId = 'dddd0000-0000-0000-0000-000000000001';

    it('throws ApiConflictError when current status is not in allowedCurrentStatuses (illegal transition)', async () => {
      // Verifies: the state-machine assertion runs on the version's own status and rejects an illegal
      // transition (version is READY, only PROCESSING allowed) before any write.

      // Step 1: Stub the version-status read to return a READY (disallowed) version
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
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
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
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
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
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
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
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
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
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
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
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
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
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
    const mockCodes: FeatureTypeWithProperties[] = [
      {
        feature_type: { feature_type_id: 1, name: 'survey', display_name: 'Survey', description: null },
        properties: [
          {
            feature_type_property_id: 1,
            name: 'title',
            display_name: 'Title',
            description: 'Title',
            type_name: FEATURE_PROPERTY_TYPE.STRING,
            required_value: true,
            calculated_value: false,
            allow_multiple: false
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
            feature_type_property_id: 2,
            name: 'species',
            display_name: 'Species',
            description: 'Species',
            type_name: FEATURE_PROPERTY_TYPE.STRING,
            required_value: false,
            calculated_value: false,
            allow_multiple: false
          }
        ]
      }
    ];

    it('returns featureTypes from active policy statements alongside the schema lookup', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
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

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
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

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves([...mockCodes].reverse());
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

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
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

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
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

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
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

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
      sinon.stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId').resolves([]);

      const result = await service.resolveParquetSchema(TEST_SOURCE);

      expect(result.featureTypes).to.deep.equal([]);
      expect(result.statements).to.deep.equal([]);
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

    // A subquery stub that exposes toSQL().toNative() — the only surface the
    // service uses on the returned Knex.QueryBuilder.
    const subqueryStub = (sql = 'SELECT 1', bindings: any[] = []) =>
      ({
        toSQL: () => ({ toNative: () => ({ sql, bindings }) })
      } as any);

    it('uses the expression-tree path when statement.expression_id is set', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      stubParquetPipeline();

      const mockTree = { type: 'expression', operator: 'AND', clauses: [] } as unknown as ExpressionTree;
      const normalizedTree = {
        type: 'expression',
        operator: 'AND',
        clauses: []
      } as unknown as NormalizedExpressionTreeExpression;
      const readTreeStub = sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(mockTree);
      const validateStub = sinon
        .stub(ExpressionPredicateSemanticValidator.prototype, 'validateExpressionTree')
        .resolves(normalizedTree);
      const buildExprSubqueryStub = sinon
        .stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery')
        .returns(subqueryStub('SELECT expression', []));
      const buildBroadStub = sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery');
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      const expressionId = '44444444-4444-4444-4444-444444444444';

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', expressionId)
      });

      expect(readTreeStub).to.have.been.calledOnceWith(expressionId);
      expect(validateStub).to.have.been.calledOnceWith(mockTree);
      expect(buildExprSubqueryStub).to.have.been.calledOnceWith(
        'observation',
        normalizedTree,
        TEST_SOURCE.requested_by
      );
      expect(buildBroadStub).to.not.have.been.called;
    });

    it('unions multiple expression ids for one effective feature-type statement', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      stubParquetPipeline();

      const mockTree = { type: 'expression', operator: 'AND', clauses: [] } as unknown as ExpressionTree;
      const normalizedTree = {
        type: 'expression',
        operator: 'AND',
        clauses: []
      } as unknown as NormalizedExpressionTreeExpression;
      const readTreeStub = sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(mockTree);
      sinon.stub(ExpressionPredicateSemanticValidator.prototype, 'validateExpressionTree').resolves(normalizedTree);

      const knex = getKnex();
      const buildExprSubqueryStub = sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');
      buildExprSubqueryStub.onCall(0).returns(knex.select(knex.raw('?::int as submission_feature_id', [1])));
      buildExprSubqueryStub.onCall(1).returns(knex.select(knex.raw('?::int as submission_feature_id', [2])));
      const buildBroadStub = sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery');
      const streamStub = sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType')
        .returns(mockBaseCursor([]));

      const expressionIds = ['44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555'];

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: { ...stmt('observation', expressionIds[0]), expression_ids: expressionIds }
      });

      expect(readTreeStub.getCalls().map((call) => call.args[0])).to.deep.equal(expressionIds);
      expect(buildExprSubqueryStub).to.have.been.calledTwice;
      expect(buildBroadStub).to.not.have.been.called;
      expect(streamStub.firstCall.args[1]).to.contain('union');
    });

    it('uses the broad path when statement.expression_id is null', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      stubParquetPipeline();

      const readTreeStub = sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree');
      const buildExprSubqueryStub = sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');
      const buildBroadStub = sinon
        .stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
      });

      expect(readTreeStub).to.not.have.been.called;
      expect(buildExprSubqueryStub).to.not.have.been.called;
      expect(buildBroadStub).to.have.been.calledOnceWith('observation', TEST_SOURCE.requested_by);
    });

    it('passes source.requested_by (the requesting user) — NOT the worker identity — through to the security filter', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      stubParquetPipeline();

      const buildBroadStub = sinon
        .stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      const requestingUserId = 999;
      const sourceWithRequester: DownloadSource = { policy_id: TEST_POLICY_ID, requested_by: requestingUserId };

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: sourceWithRequester,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
      });

      expect(buildBroadStub).to.have.been.calledOnceWith('observation', requestingUserId);
    });

    it('streams features through the writer and uploads with deterministic S3 key', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter, uploadStub } = stubParquetPipeline();

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      const baseBatch = [
        {
          submission_feature_id: 1,
          uuid: 'uuid-1',
          feature_type_name: 'observation',
          data: { properties: {} },
          parent_uuid: null
        }
      ];
      sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType')
        .returns(mockBaseCursor([baseBatch]));
      sinon
        .stub(DownloadRepository.prototype, 'fetchTypedPropertyRows')
        .resolves([{ submission_feature_id: 1, name: 'species', value: 'moose', storage_type: 'string' }]);

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
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

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        properties: mockSpatialProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
      });

      expect(mockWriter.setMetadata).to.have.been.calledOnce;
      expect(mockWriter.setMetadata.firstCall.args[0]).to.equal('geo');
      expect(mockWriter.setMetadata.firstCall.args[1]).to.be.a('string');
    });

    it('does not set GeoParquet metadata when feature type has no spatial properties', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
      });

      expect(mockWriter.setMetadata).to.not.have.been.called;
    });

    it('inserts artifact with uploaded status, parquet format, and the deterministic S3 key', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { insertArtifactStub } = stubParquetPipeline();

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
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

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType')
        .returns(mockBaseCursor([[{ submission_feature_id: 1 }]]));
      const hydrateError = new Error('hydration blew up');
      sinon.stub(DownloadPipelineService.prototype, 'hydrateFeatureBatch').rejects(hydrateError);

      let caught: unknown;
      try {
        await service.writeFeatureTypeParquet({
          downloadId: TEST_DOWNLOAD_ID,
          downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
          source: TEST_SOURCE,
          properties: mockProperties,
          featureTypeName: 'observation',
          statement: stmt('observation', null)
        });
      } catch (e) {
        caught = e;
      }

      // Original error wins; upload-abort rejection is swallowed.
      expect(caught).to.equal(hydrateError);
      expect(uploadStub).to.have.been.calledOnce;
    });

    it('does NOT deadlock when the upload promise never settles after a hydrate error (sticky-upload guard)', async () => {
      // Real S3/MinIO multipart uploads can swallow `passThrough.destroy(...)` and
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

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType')
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
          source: TEST_SOURCE,
          properties: mockProperties,
          featureTypeName: 'observation',
          statement: stmt('observation', null)
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

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      let caught: unknown;
      try {
        await service.writeFeatureTypeParquet({
          downloadId: TEST_DOWNLOAD_ID,
          downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
          source: TEST_SOURCE,
          properties: mockProperties,
          featureTypeName: 'observation',
          statement: stmt('observation', null)
        });
      } catch (e) {
        caught = e;
      }

      // The original writer-init error wins; upload-abort rejection is swallowed.
      expect(caught).to.equal(writerError);
      expect(uploadStub).to.have.been.calledOnce;
    });

    it('does not start the upload when readExpressionTree fails before upload setup', async () => {
      // The stricter form of the same fix: every cheap precondition that *can* throw
      // (expression read, semantic validation, subquery build) runs BEFORE upload
      // creation, so a thrown precondition leaves the worker with zero S3 state to
      // clean up. This test pins that ordering — uploadStream is never called.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const treeError = new Error('expression tree gone');
      sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').rejects(treeError);

      const uploadStub = sinon.stub(ObjectStorageService.prototype, 'uploadStream');
      sinon.stub(parquetjs.ParquetWriter, 'openStream');
      sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');

      let caught: unknown;
      try {
        await service.writeFeatureTypeParquet({
          downloadId: TEST_DOWNLOAD_ID,
          downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
          source: TEST_SOURCE,
          properties: mockProperties,
          featureTypeName: 'observation',
          statement: stmt('observation', '44444444-4444-4444-4444-444444444444')
        });
      } catch (e) {
        caught = e;
      }

      expect(caught).to.equal(treeError);
      expect(uploadStub).to.not.have.been.called;
    });

    it('links the artifact to the download version (not the download) after the artifact row is created', async () => {
      // Verifies: the produced artifact is linked via createDownloadVersionArtifact against the
      // version id — keyed by feature type — and that the link write happens after the artifact
      // row exists (the FK requires the artifact first).
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { insertArtifactStub, linkStub } = stubParquetPipeline();

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
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

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType')
        .returns(
          mockBaseCursor([[{ submission_feature_id: 1 }, { submission_feature_id: 2 }], [{ submission_feature_id: 3 }]])
        );

      const hydrateStub = sinon.stub(DownloadPipelineService.prototype, 'hydrateFeatureBatch');
      hydrateStub.onCall(0).resolves([hydratedFeature(1), hydratedFeature(2)]);
      hydrateStub.onCall(1).resolves([hydratedFeature(3)]);

      const result = await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
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

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      // Base batch has 3 rows...
      sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType')
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
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
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

      sinon.stub(expressionEvaluation, 'buildBroadFeatureTypeSubquery').returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      const result = await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        downloadVersionId: TEST_DOWNLOAD_VERSION_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
      });

      expect(result).to.equal(0);
      expect(mockWriter.appendRow).to.not.have.been.called;
    });
  });

  describe('hydrateFeatureBatch', () => {
    // The merge works on (property, storage type), not property name alone: a property's rows
    // can arrive from more than one storage table, because redeclaring a property does not
    // relocate rows written under its previous type.
    const baseBatch = [
      {
        submission_feature_id: 1,
        uuid: 'uuid-1',
        feature_type_name: 'observation',
        data: {},
        parent_uuid: null
      }
    ] as any[];

    const taxonProperties: CsvPropertyDefinition[] = [
      { feature_property_name: 'taxon_id', feature_property_type_name: 'taxon' }
    ];

    it('passes the batch feature type through to the repository fetch', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const fetchStub = sinon.stub(DownloadRepository.prototype, 'fetchTypedPropertyRows').resolves([]);

      await service.hydrateFeatureBatch(baseBatch, taxonProperties);

      expect(fetchStub).to.have.been.calledOnceWith([1], ['taxon'], 'observation');
    });

    it('carries a foreign-stored value into a string-coercible declared column', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      // taxon_id declared `taxon` but its value sits in the number table.
      sinon
        .stub(DownloadRepository.prototype, 'fetchTypedPropertyRows')
        .resolves([{ submission_feature_id: 1, name: 'taxon_id', value: 625197, storage_type: 'number' }]);

      const hydrated = await service.hydrateFeatureBatch(baseBatch, taxonProperties);

      expect(hydrated[0].data['taxon_id']).to.equal(625197);
    });

    it('prefers the declared-storage value over a foreign one regardless of row order', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'fetchTypedPropertyRows').resolves([
        { submission_feature_id: 1, name: 'taxon_id', value: 625197, storage_type: 'number' },
        { submission_feature_id: 1, name: 'taxon_id', value: 'Alces alces', storage_type: 'taxon' }
      ]);

      const hydrated = await service.hydrateFeatureBatch(baseBatch, taxonProperties);

      expect(hydrated[0].data['taxon_id']).to.equal('Alces alces');
    });

    it('keeps the declared-storage value when it arrives before the foreign one', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'fetchTypedPropertyRows').resolves([
        { submission_feature_id: 1, name: 'taxon_id', value: 'Alces alces', storage_type: 'taxon' },
        { submission_feature_id: 1, name: 'taxon_id', value: 625197, storage_type: 'number' }
      ]);

      const hydrated = await service.hydrateFeatureBatch(baseBatch, taxonProperties);

      expect(hydrated[0].data['taxon_id']).to.equal('Alces alces');
    });

    it('keeps the first foreign value when two foreign rows tie', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'fetchTypedPropertyRows').resolves([
        { submission_feature_id: 1, name: 'taxon_id', value: 625197, storage_type: 'number' },
        { submission_feature_id: 1, name: 'taxon_id', value: 'stray', storage_type: 'string' }
      ]);

      const hydrated = await service.hydrateFeatureBatch(baseBatch, taxonProperties);

      expect(hydrated[0].data['taxon_id']).to.equal(625197);
    });

    it('drops a foreign value bound for a number-declared column (writer coerces, not validates)', async () => {
      // A DOUBLE column would `parseFloat` a stray string into NaN silently; a BOOLEAN column
      // truthiness-coerces. A null cell is the honest outcome over silent corruption.
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      const numberProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'count', feature_property_type_name: 'number' }
      ];

      sinon
        .stub(DownloadRepository.prototype, 'fetchTypedPropertyRows')
        .resolves([{ submission_feature_id: 1, name: 'count', value: 'not-a-number', storage_type: 'string' }]);

      const hydrated = await service.hydrateFeatureBatch(baseBatch, numberProperties);

      expect(hydrated[0].data['count']).to.be.null;
    });

    it('accumulates foreign cell counts per property when an accumulator is supplied', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'fetchTypedPropertyRows').resolves([
        { submission_feature_id: 1, name: 'taxon_id', value: 625197, storage_type: 'number' },
        { submission_feature_id: 2, name: 'taxon_id', value: 180703, storage_type: 'number' },
        { submission_feature_id: 2, name: 'sign', value: 'tracks', storage_type: 'string' }
      ]);

      const twoFeatureBatch = [
        ...baseBatch,
        { submission_feature_id: 2, uuid: 'uuid-2', feature_type_name: 'observation', data: {}, parent_uuid: null }
      ] as any[];
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'taxon_id', feature_property_type_name: 'taxon' },
        { feature_property_name: 'sign', feature_property_type_name: 'string' }
      ];

      const foreignUsage: Record<string, number> = {};
      await service.hydrateFeatureBatch(twoFeatureBatch, properties, foreignUsage);

      // Two foreign taxon_id cells; `sign` came from its declared table and is not counted.
      expect(foreignUsage).to.deep.equal({ taxon_id: 2 });
    });

    it('does not count declared-storage cells as foreign', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'fetchTypedPropertyRows')
        .resolves([{ submission_feature_id: 1, name: 'taxon_id', value: 'Alces alces', storage_type: 'taxon' }]);

      const foreignUsage: Record<string, number> = {};
      await service.hydrateFeatureBatch(baseBatch, taxonProperties, foreignUsage);

      expect(foreignUsage).to.deep.equal({});
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
