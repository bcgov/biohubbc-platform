import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { DownloadDetailRecord } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { publisherDependencies } from '../publisher';
import {
  IProcessDownloadJobData,
  processDownloadFailedHandler,
  processDownloadJobHandler
} from './process-download-job';

chai.use(sinonChai);

describe('process-download-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (downloadId: string, jobId = 'test-job-id') =>
    ({
      id: jobId,
      name: 'process-download',
      data: { downloadId }
    } as PgBoss.Job<IProcessDownloadJobData>);

  /**
   * Stubs getAPIUserDBConnection and returns a mock connection that supports
   * open/commit/rollback/release for withConnection usage.
   */
  const setupMockConnection = () => {
    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.rollback = sinon.stub().resolves();
    mockDBConnection.release = sinon.stub();
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);
    return mockDBConnection;
  };

  const DOWNLOAD_VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';

  const createMockDownloadRecord = (overrides?: Partial<DownloadDetailRecord>): DownloadDetailRecord => ({
    download_id: 'dl-1',
    download_status: DownloadStatusEnum.PENDING,
    format: 'parquet',
    metadata: null,
    started_at: null,
    completed_at: null,
    downloaded_at: null,
    create_date: '2026-01-01T00:00:00.000Z',
    current_download_version_id: DOWNLOAD_VERSION_ID,
    name: 'Test download',
    description: null,
    ...overrides
  });

  const createMockStatement = (urn_feature_type: string, expression_id: string | null = null) => ({
    policy_statement_id: `psid-${urn_feature_type}`,
    urn_feature_type,
    expression_id
  });

  describe('processDownloadJobHandler', () => {
    it('transitions pending → processing → ready for a download with 3 feature types', async () => {
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());

      const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();
      const source = { policy_id: '11111111-1111-1111-1111-111111111111', requested_by: 1 };
      sinon.stub(DownloadRepository.prototype, 'getDownloadSource').resolves(source);

      const schemaLookup = new Map<string, CsvPropertyDefinition[]>();
      schemaLookup.set('a', [{ feature_property_name: 'one', feature_property_type_name: 'string' }]);
      schemaLookup.set('b', [{ feature_property_name: 'two', feature_property_type_name: 'string' }]);
      schemaLookup.set('c', [{ feature_property_name: 'three', feature_property_type_name: 'string' }]);

      const statements = [createMockStatement('a'), createMockStatement('b'), createMockStatement('c')];
      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup,
        featureTypes: ['a', 'b', 'c'],
        statements
      });

      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();

      await processDownloadJobHandler([createMockJob('dl-1')]);

      // Two status transitions: first to PROCESSING, then to READY
      expect(transitionStub).to.have.been.calledTwice;
      expect(transitionStub.firstCall.args[0]).to.equal('dl-1');
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      expect(transitionStub.firstCall.args[2]).to.deep.equal([
        DownloadStatusEnum.PENDING,
        DownloadStatusEnum.PROCESSING
      ]);

      expect(transitionStub.secondCall.args[0]).to.equal('dl-1');
      expect(transitionStub.secondCall.args[1]).to.equal(DownloadStatusEnum.READY);
      expect(transitionStub.secondCall.args[2]).to.deep.equal([DownloadStatusEnum.PROCESSING]);

      // writeFeatureTypeParquet called once per statement, in statements order. Each payload
      // threads the download's materialized version id (read from current_download_version_id)
      // so the produced artifacts link to that version.
      expect(writeStub).to.have.been.calledThrice;
      expect(writeStub.firstCall.args[0]).to.deep.include({
        downloadId: 'dl-1',
        downloadVersionId: DOWNLOAD_VERSION_ID,
        source,
        featureTypeName: 'a',
        statement: statements[0]
      });
      expect(writeStub.secondCall.args[0]).to.deep.include({
        downloadId: 'dl-1',
        downloadVersionId: DOWNLOAD_VERSION_ID,
        source,
        featureTypeName: 'b',
        statement: statements[1]
      });
      expect(writeStub.thirdCall.args[0]).to.deep.include({
        downloadId: 'dl-1',
        downloadVersionId: DOWNLOAD_VERSION_ID,
        source,
        featureTypeName: 'c',
        statement: statements[2]
      });
    });

    it('calls writeFeatureTypeParquet with the properties looked up from schemaLookup for each feature type', async () => {
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();
      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ policy_id: '11111111-1111-1111-1111-111111111111', requested_by: 1 });

      const obsProps: CsvPropertyDefinition[] = [
        { feature_property_name: 'count', feature_property_type_name: 'number' }
      ];
      const surveyProps: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' }
      ];

      const schemaLookup = new Map<string, CsvPropertyDefinition[]>();
      schemaLookup.set('observation', obsProps);
      schemaLookup.set('survey', surveyProps);

      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup,
        featureTypes: ['observation', 'survey'],
        statements: [createMockStatement('observation'), createMockStatement('survey')]
      });

      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();

      await processDownloadJobHandler([createMockJob('dl-1')]);

      expect(writeStub.firstCall.args[0].featureTypeName).to.equal('observation');
      expect(writeStub.firstCall.args[0].properties).to.deep.equal(obsProps);

      expect(writeStub.secondCall.args[0].featureTypeName).to.equal('survey');
      expect(writeStub.secondCall.args[0].properties).to.deep.equal(surveyProps);
    });

    it('skips writeFeatureTypeParquet and still transitions to READY when featureTypes is empty', async () => {
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();
      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ policy_id: '11111111-1111-1111-1111-111111111111', requested_by: 1 });
      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup: new Map<string, CsvPropertyDefinition[]>(),
        featureTypes: [],
        statements: []
      });

      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();

      await processDownloadJobHandler([createMockJob('dl-1')]);

      expect(writeStub).to.not.have.been.called;

      // Still transitioned pending → processing and processing → ready
      expect(transitionStub).to.have.been.calledTwice;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      expect(transitionStub.secondCall.args[1]).to.equal(DownloadStatusEnum.READY);
    });

    it('enters processing cleanly when a mid-job retry finds the download already in PROCESSING', async () => {
      setupMockConnection();

      sinon
        .stub(DownloadRepository.prototype, 'findDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.PROCESSING }));

      const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();
      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ policy_id: '11111111-1111-1111-1111-111111111111', requested_by: 1 });
      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup: new Map<string, CsvPropertyDefinition[]>(),
        featureTypes: [],
        statements: []
      });

      await processDownloadJobHandler([createMockJob('dl-1')]);

      expect(transitionStub).to.have.been.calledTwice;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
    });

    for (const terminalStatus of [DownloadStatusEnum.READY, DownloadStatusEnum.FAILED, DownloadStatusEnum.DOWNLOADED]) {
      it(`skips silently when status is terminal (${terminalStatus})`, async () => {
        setupMockConnection();

        sinon
          .stub(DownloadRepository.prototype, 'findDownloadById')
          .resolves(createMockDownloadRecord({ download_status: terminalStatus }));

        const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();
        const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();

        await processDownloadJobHandler([createMockJob('dl-1')]);

        // No work done — guard returned early
        expect(transitionStub).to.not.have.been.called;
        expect(writeStub).to.not.have.been.called;
      });
    }

    it('throws when findDownloadById returns null', async () => {
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(null);

      const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();
      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();

      try {
        await processDownloadJobHandler([createMockJob('dl-1')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('Download dl-1 not found');
      }

      expect(transitionStub).to.not.have.been.called;
      expect(writeStub).to.not.have.been.called;
    });

    it('throws (and does no work) when the download has no materialized version (current_download_version_id null)', async () => {
      // Verifies: the non-null guard. A download being processed must already have a materialized
      // version; a null pointer means the create transaction never wired one up, so the worker
      // refuses to proceed rather than write artifacts with no version to link them to.
      setupMockConnection();

      sinon
        .stub(DownloadRepository.prototype, 'findDownloadById')
        .resolves(createMockDownloadRecord({ current_download_version_id: null }));

      const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();
      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();

      try {
        await processDownloadJobHandler([createMockJob('dl-1')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('Download dl-1 has no materialized version — cannot process');
      }

      // Guard fires before any status transition or parquet write.
      expect(transitionStub).to.not.have.been.called;
      expect(writeStub).to.not.have.been.called;
    });

    it('propagates error from writeFeatureTypeParquet without transitioning to READY', async () => {
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();
      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ policy_id: '11111111-1111-1111-1111-111111111111', requested_by: 1 });

      const schemaLookup = new Map<string, CsvPropertyDefinition[]>();
      schemaLookup.set('a', []);

      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup,
        featureTypes: ['a'],
        statements: [createMockStatement('a')]
      });

      const testError = new Error('S3 upload failed');
      sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').rejects(testError);

      try {
        await processDownloadJobHandler([createMockJob('dl-1')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }

      // Only the first transition (to PROCESSING) was called; the READY transition never runs
      expect(transitionStub).to.have.been.calledOnce;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
    });

    const stubPgBoss = () => {
      const sendStub = sinon.stub().resolves('mock-job-id');
      const createQueueStub = sinon.stub().resolves();
      sinon.stub(publisherDependencies, 'getPgBoss').returns({ send: sendStub, createQueue: createQueueStub } as any);
      return sendStub;
    };

    it('does not auto-enqueue an export for an anonymous download (requested_by null)', async () => {
      setupMockConnection();
      const sendStub = stubPgBoss();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();
      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ policy_id: '11111111-1111-1111-1111-111111111111', requested_by: null });
      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup: new Map<string, CsvPropertyDefinition[]>(),
        featureTypes: [],
        statements: []
      });

      await processDownloadJobHandler([createMockJob('dl-1')]);

      expect(sendStub).to.not.have.been.called;
    });

    it('does not auto-enqueue an export for an authenticated download (requested_by set)', async () => {
      setupMockConnection();
      const sendStub = stubPgBoss();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();
      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ policy_id: '11111111-1111-1111-1111-111111111111', requested_by: 42 });
      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup: new Map<string, CsvPropertyDefinition[]>(),
        featureTypes: [],
        statements: []
      });

      await processDownloadJobHandler([createMockJob('dl-1')]);

      expect(sendStub).to.not.have.been.called;
    });
  });

  describe('processDownloadFailedHandler', () => {
    const createMockFailedJob = (downloadId: string, jobId = 'dlq-job-id', output?: unknown) =>
      ({
        id: jobId,
        name: '__state__completed__process-download',
        data: { downloadId },
        output
      } as PgBoss.JobWithMetadata<IProcessDownloadJobData>);

    const setupDLQMocks = () => {
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      const commitStub = sinon.stub().resolves();
      const rollbackStub = sinon.stub().resolves();
      mockDBConnection.commit = commitStub;
      mockDBConnection.rollback = rollbackStub;
      mockDBConnection.release = sinon.stub();

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);
      return { commitStub, rollbackStub };
    };

    it('transitions to failed with error metadata for a string job output', async () => {
      setupDLQMocks();

      sinon
        .stub(DownloadRepository.prototype, 'findDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.PROCESSING }));

      const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();

      await processDownloadFailedHandler([createMockFailedJob('dl-1', 'dlq-job-id', 'something went wrong')]);

      expect(transitionStub).to.have.been.calledOnce;
      expect(transitionStub.firstCall.args[0]).to.equal('dl-1');
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.FAILED);
      expect(transitionStub.firstCall.args[2]).to.deep.equal([
        DownloadStatusEnum.PENDING,
        DownloadStatusEnum.PROCESSING
      ]);
      expect(transitionStub.firstCall.args[3]).to.deep.equal({ error: 'something went wrong' });
    });

    it('uses generic error message when job output is not a string', async () => {
      setupDLQMocks();

      sinon
        .stub(DownloadRepository.prototype, 'findDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.PROCESSING }));

      const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();

      await processDownloadFailedHandler([createMockFailedJob('dl-1', 'dlq-job-id', { whatever: 'obj' })]);

      expect(transitionStub.firstCall.args[3]).to.deep.equal({ error: 'Job failed after all retries' });
    });

    for (const terminalStatus of [DownloadStatusEnum.READY, DownloadStatusEnum.FAILED, DownloadStatusEnum.DOWNLOADED]) {
      it(`skips silently when the download is already in terminal status (${terminalStatus})`, async () => {
        const { commitStub, rollbackStub } = setupDLQMocks();

        sinon
          .stub(DownloadRepository.prototype, 'findDownloadById')
          .resolves(createMockDownloadRecord({ download_status: terminalStatus }));

        const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();

        await processDownloadFailedHandler([createMockFailedJob('dl-1', 'dlq-job-id', 'anything')]);

        expect(transitionStub).to.not.have.been.called;
        expect(commitStub).to.have.been.calledOnce;
        expect(rollbackStub).to.not.have.been.called;
      });
    }

    it('skips silently when the download is not found', async () => {
      const { commitStub, rollbackStub } = setupDLQMocks();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(null);

      const transitionStub = sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').resolves();

      await processDownloadFailedHandler([createMockFailedJob('dl-1', 'dlq-job-id', 'anything')]);

      expect(transitionStub).to.not.have.been.called;
      expect(commitStub).to.have.been.calledOnce;
      expect(rollbackStub).to.not.have.been.called;
    });

    it('rethrows unexpected errors from transitionDownloadStatus', async () => {
      const { commitStub, rollbackStub } = setupDLQMocks();

      sinon
        .stub(DownloadRepository.prototype, 'findDownloadById')
        .resolves(createMockDownloadRecord({ download_status: DownloadStatusEnum.PROCESSING }));

      const testError = new Error('unexpected');
      sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadStatus').rejects(testError);

      try {
        await processDownloadFailedHandler([createMockFailedJob('dl-1', 'dlq-job-id', 'anything')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }

      expect(rollbackStub).to.have.been.calledOnce;
      expect(commitStub).to.not.have.been.called;
    });
  });
});
