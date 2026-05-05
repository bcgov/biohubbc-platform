import * as parquetjs from '@dsnp/parquetjs';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockDownloadRecord } from '../../__mocks__/download';
import { ApiConflictError } from '../../errors/api-error';
import { DownloadSource } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { ExpressionTree } from '../../models/expression-tree';
import { NormalizedExpressionTreeExpression } from '../../models/expression-tree-internal';
import { FEATURE_PROPERTY_TYPE } from '../../models/feature-property';
import { FeatureTypeWithProperties } from '../../models/feature-type';
import {
  ActivePolicyStatementWithExpression,
  PolicyStatementRepository
} from '../../repositories/authorization/policy-statement-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { ExpressionEvaluationRepository } from '../../repositories/expression-evaluation-repository';
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

  describe('transitionDownloadStatus', () => {
    const downloadId = 'aaaa0000-0000-0000-0000-000000000042';

    it('propagates getDownloadById throw when download does not exist (does NOT call updateDownloadStatus)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'getDownloadById').rejects(new Error('Download not found'));
      const updateStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      try {
        await service.transitionDownloadStatus(downloadId, DownloadStatusEnum.PROCESSING, [DownloadStatusEnum.PENDING]);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err.message).to.equal('Download not found');
      }

      expect(updateStub.called).to.be.false;
    });

    it('throws ApiConflictError when current status is not in allowedCurrentStatuses (illegal transition)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.READY }));
      const updateStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      try {
        await service.transitionDownloadStatus(downloadId, DownloadStatusEnum.PROCESSING, [DownloadStatusEnum.PENDING]);
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiConflictError);
        expect(err.message).to.equal('Invalid download status transition');
      }

      expect(updateStub.called).to.be.false;
    });

    it('calls updateDownloadStatus with started_at set for pending→processing', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.PENDING }));
      const updateStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      await service.transitionDownloadStatus(downloadId, DownloadStatusEnum.PROCESSING, [DownloadStatusEnum.PENDING]);

      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.equal(downloadId);
      expect(updateStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      const metadata = updateStub.firstCall.args[2] as { started_at?: string; completed_at?: string };
      expect(metadata.started_at).to.be.a('string');
      expect(new Date(metadata.started_at!).toISOString()).to.equal(metadata.started_at);
      expect(metadata.completed_at).to.be.undefined;
    });

    it('calls updateDownloadStatus with completed_at set for processing→ready', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      await service.transitionDownloadStatus(downloadId, DownloadStatusEnum.READY, [DownloadStatusEnum.PROCESSING]);

      const metadata = updateStub.firstCall.args[2] as { started_at?: string; completed_at?: string };
      expect(metadata.started_at).to.be.undefined;
      expect(metadata.completed_at).to.be.a('string');
    });

    it('passes completed_at and error metadata for processing→failed', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.PROCESSING }));
      const updateStub = sinon.stub(DownloadRepository.prototype, 'updateDownloadStatus').resolves();

      await service.transitionDownloadStatus(
        downloadId,
        DownloadStatusEnum.FAILED,
        [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING],
        { error: 'job failed after all retries' }
      );

      const metadata = updateStub.firstCall.args[2] as {
        error?: string;
        started_at?: string;
        completed_at?: string;
      };
      expect(metadata.error).to.equal('job failed after all retries');
      expect(metadata.completed_at).to.be.a('string');
    });
  });

  // -------------------------------------------------------------------------
  // Parquet pipeline methods
  // -------------------------------------------------------------------------

  // Shared test data for Parquet tests
  const TEST_DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000042';
  const TEST_POLICY_ID = '11111111-1111-1111-1111-111111111111';
  const TEST_SOURCE: DownloadSource = { policy_id: TEST_POLICY_ID, create_user: 7 };

  const stmt = (
    urn_feature_type: string,
    expression_id: string | null = null
  ): ActivePolicyStatementWithExpression => ({
    policy_statement_id: '22222222-2222-2222-2222-222222222222',
    urn_feature_type,
    expression_id
  });

  describe('resolveParquetSchema', () => {
    const mockCodes: FeatureTypeWithProperties[] = [
      {
        feature_type: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
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
        feature_type: { feature_type_id: 2, name: 'observation', display_name: 'Observation' },
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
      const statements = [stmt('dataset'), stmt('observation', '33333333-3333-3333-3333-333333333333')];
      sinon
        .stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId')
        .resolves(statements);

      const result = await service.resolveParquetSchema(TEST_DOWNLOAD_ID, TEST_SOURCE);

      expect(result.featureTypes).to.deep.equal(['dataset', 'observation']);
      expect(result.statements).to.deep.equal(statements);
      expect(result.schemaLookup.has('dataset')).to.be.true;
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

      const result = await service.resolveParquetSchema(TEST_DOWNLOAD_ID, TEST_SOURCE);

      expect(result.featureTypes).to.deep.equal(['a', 'b', 'c']);
    });

    it('returns empty featureTypes and statements for a policy with no active statements', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
      sinon.stub(PolicyStatementRepository.prototype, 'getActiveStatementsWithExpressionByPolicyId').resolves([]);

      const result = await service.resolveParquetSchema(TEST_DOWNLOAD_ID, TEST_SOURCE);

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
      const linkStub = sinon.stub(DownloadRepository.prototype, 'createDownloadArtifact').resolves();
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
        .stub(ExpressionEvaluationRepository.prototype, 'buildExpressionTreeFeatureIdsSubquery')
        .returns(subqueryStub('SELECT expression', []));
      const buildBroadStub = sinon.stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery');
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      const expressionId = '44444444-4444-4444-4444-444444444444';

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', expressionId)
      });

      expect(readTreeStub).to.have.been.calledOnceWith(expressionId);
      expect(validateStub).to.have.been.calledOnceWith(mockTree);
      expect(buildExprSubqueryStub).to.have.been.calledOnceWith('observation', normalizedTree, TEST_SOURCE.create_user);
      expect(buildBroadStub).to.not.have.been.called;
    });

    it('uses the broad path when statement.expression_id is null', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      stubParquetPipeline();

      const readTreeStub = sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree');
      const buildExprSubqueryStub = sinon.stub(
        ExpressionEvaluationRepository.prototype,
        'buildExpressionTreeFeatureIdsSubquery'
      );
      const buildBroadStub = sinon
        .stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
      });

      expect(readTreeStub).to.not.have.been.called;
      expect(buildExprSubqueryStub).to.not.have.been.called;
      expect(buildBroadStub).to.have.been.calledOnceWith('observation', TEST_SOURCE.create_user);
    });

    it('passes source.create_user (the policy creator) — NOT the worker identity — through to the security filter', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      stubParquetPipeline();

      const buildBroadStub = sinon
        .stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      const policyCreatorId = 999;
      const sourceWithCreator: DownloadSource = { policy_id: TEST_POLICY_ID, create_user: policyCreatorId };

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: sourceWithCreator,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
      });

      expect(buildBroadStub).to.have.been.calledOnceWith('observation', policyCreatorId);
    });

    it('streams features through the writer and uploads with deterministic S3 key', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter, uploadStub } = stubParquetPipeline();

      sinon
        .stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
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
        .resolves([{ submission_feature_id: 1, name: 'species', value: 'moose' }]);

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
      });

      expect(mockWriter.appendRow).to.have.been.calledOnce;
      expect(mockWriter.close).to.have.been.calledOnce;
      expect(uploadStub).to.have.been.calledOnce;
      expect(uploadStub.firstCall.args[3]).to.equal(`downloads/${TEST_DOWNLOAD_ID}/observation/data.parquet`);
    });

    it('sets GeoParquet metadata on the writer when feature type has spatial properties', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      sinon
        .stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
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

      sinon
        .stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
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

      sinon
        .stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
      });

      expect(insertArtifactStub).to.have.been.calledOnce;
      const payload = insertArtifactStub.firstCall.args[0];
      expect(payload.artifact_status).to.equal('uploaded');
      expect(payload.format).to.equal('parquet');
      expect(payload.object_key).to.equal(`downloads/${TEST_DOWNLOAD_ID}/observation/data.parquet`);
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
        .stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
      sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType')
        .returns(mockBaseCursor([[{ submission_feature_id: 1 }]]));
      const hydrateError = new Error('hydration blew up');
      sinon.stub(DownloadPipelineService.prototype, 'hydrateFeatureBatch').rejects(hydrateError);

      let caught: unknown;
      try {
        await service.writeFeatureTypeParquet({
          downloadId: TEST_DOWNLOAD_ID,
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

      sinon
        .stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
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

      sinon
        .stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      let caught: unknown;
      try {
        await service.writeFeatureTypeParquet({
          downloadId: TEST_DOWNLOAD_ID,
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
      sinon.stub(ExpressionEvaluationRepository.prototype, 'buildExpressionTreeFeatureIdsSubquery');

      let caught: unknown;
      try {
        await service.writeFeatureTypeParquet({
          downloadId: TEST_DOWNLOAD_ID,
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

    it('inserts the download_artifact link after the artifact row is created', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { insertArtifactStub, linkStub } = stubParquetPipeline();

      sinon
        .stub(ExpressionEvaluationRepository.prototype, 'buildBroadFeatureTypeSubquery')
        .returns(subqueryStub('SELECT broad', []));
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE,
        properties: mockProperties,
        featureTypeName: 'observation',
        statement: stmt('observation', null)
      });

      expect(insertArtifactStub).to.have.been.calledOnce;
      expect(linkStub).to.have.been.calledOnce;
      expect(linkStub.firstCall.args[0]).to.equal(TEST_DOWNLOAD_ID);
      expect(linkStub.firstCall.args[1]).to.equal('bbbb0000-0000-0000-0000-000000000001');
      expect(linkStub).to.have.been.calledAfter(insertArtifactStub);
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
