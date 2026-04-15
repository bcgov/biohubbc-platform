import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { getMockDBConnection } from '../../__mocks__/db';
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
    sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);
    return mockDBConnection;
  };

  describe('processDownloadJobHandler — format branching', () => {
    it('routes to parquet pipeline when format is "parquet"', async () => {
      // Verifies: format === 'parquet' triggers parquet-specific service methods
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves({
        download_id: 'dl-1',
        download_status: DownloadStatusEnum.PENDING,
        format: 'parquet',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        total_fragments: 0,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        fragment_size_bytes: '104857600',
        create_date: '2025-01-01T00:00:00Z'
      });

      const updateStatusStub = sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();

      const metadataStub = sinon.stub(DownloadPipelineService.prototype, 'getDownloadMetadata').resolves({
        source: { cart_id: 'cart-1', filters: null, create_user: 1 },
        artifact: { artifact_id: 'art-1', object_key: 'downloads/dl-1' }
      });

      const schemaLookup = new Map<string, CsvPropertyDefinition[]>();
      schemaLookup.set('observation', [{ feature_property_name: 'count', feature_property_type_name: 'number' }]);
      schemaLookup.set('survey', [{ feature_property_name: 'name', feature_property_type_name: 'string' }]);

      const schemaStub = sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup,
        featureTypes: ['observation', 'survey']
      });

      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();
      const finalizeStub = sinon.stub(DownloadPipelineService.prototype, 'finalizeParquetDownload').resolves();

      // Fragment pipeline methods should NOT be called
      const planStub = sinon.stub(DownloadPipelineService.prototype, 'planDownloadIfNeeded').resolves();

      await processDownloadJobHandler([createMockJob('dl-1')]);

      // Parquet pipeline methods called
      expect(updateStatusStub).to.have.been.calledOnce;
      expect(metadataStub).to.have.been.calledOnceWith('dl-1');
      expect(schemaStub).to.have.been.calledOnce;
      expect(writeStub).to.have.been.calledTwice;
      expect(finalizeStub).to.have.been.calledOnceWith('dl-1');

      // Fragment pipeline methods NOT called
      expect(planStub).not.to.have.been.called;
    });

    it('routes to fragment pipeline when format is "csv"', async () => {
      // Verifies: format !== 'parquet' preserves the existing fragment-based pipeline
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves({
        download_id: 'dl-2',
        download_status: DownloadStatusEnum.PENDING,
        format: 'csv',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        total_fragments: 0,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        fragment_size_bytes: '104857600',
        create_date: '2025-01-01T00:00:00Z'
      });

      const planStub = sinon.stub(DownloadPipelineService.prototype, 'planDownloadIfNeeded').resolves();
      sinon.stub(DownloadPipelineService.prototype, 'getFragmentsToProcess').resolves([]);
      sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();
      const finalizeStub = sinon.stub(DownloadPipelineService.prototype, 'finalizeDownload').resolves();

      // Parquet pipeline methods should NOT be called
      const metadataStub = sinon.stub(DownloadPipelineService.prototype, 'getDownloadMetadata');
      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet');

      await processDownloadJobHandler([createMockJob('dl-2')]);

      // Fragment pipeline methods called
      expect(planStub).to.have.been.calledOnce;
      expect(finalizeStub).to.have.been.calledOnce;

      // Parquet pipeline methods NOT called
      expect(metadataStub).not.to.have.been.called;
      expect(writeStub).not.to.have.been.called;
    });

    it('throws when download record not found', async () => {
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(null);

      try {
        await processDownloadJobHandler([createMockJob('nonexistent-id')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('Download nonexistent-id not found');
      }
    });
  });

  describe('processDownloadJobHandler — parquet pipeline orchestration', () => {
    it('calls phases in correct order: status → metadata → schema → per-type write → finalize', async () => {
      // Verifies: Parquet phases are orchestrated in the correct sequence
      setupMockConnection();

      const callOrder: string[] = [];

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves({
        download_id: 'dl-1',
        download_status: DownloadStatusEnum.PENDING,
        format: 'parquet',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        total_fragments: 0,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        fragment_size_bytes: '104857600',
        create_date: '2025-01-01T00:00:00Z'
      });

      sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').callsFake(async () => {
        callOrder.push('updateStatus');
      });

      sinon.stub(DownloadPipelineService.prototype, 'getDownloadMetadata').callsFake(async () => {
        callOrder.push('getMetadata');
        return {
          source: { cart_id: 'cart-1', filters: null, create_user: 1 },
          artifact: { artifact_id: 'art-1', object_key: 'downloads/dl-1' }
        };
      });

      const schemaLookup = new Map<string, CsvPropertyDefinition[]>();
      schemaLookup.set('observation', [{ feature_property_name: 'count', feature_property_type_name: 'number' }]);

      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').callsFake(async () => {
        callOrder.push('resolveSchema');
        return { schemaLookup, featureTypes: ['observation'] };
      });

      sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').callsFake(async () => {
        callOrder.push('writeParquet');
      });

      sinon.stub(DownloadPipelineService.prototype, 'finalizeParquetDownload').callsFake(async () => {
        callOrder.push('finalize');
      });

      await processDownloadJobHandler([createMockJob('dl-1')]);

      expect(callOrder).to.deep.equal(['updateStatus', 'getMetadata', 'resolveSchema', 'writeParquet', 'finalize']);
    });

    it('writes each feature type in its own withConnection', async () => {
      // Verifies: Per-type connection isolation — each writeFeatureTypeParquet call
      // gets its own transaction so completed types survive retries
      const mockDBConnection = setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves({
        download_id: 'dl-1',
        download_status: DownloadStatusEnum.PENDING,
        format: 'parquet',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        total_fragments: 0,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        fragment_size_bytes: '104857600',
        create_date: '2025-01-01T00:00:00Z'
      });

      sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();
      sinon.stub(DownloadPipelineService.prototype, 'getDownloadMetadata').resolves({
        source: { cart_id: 'cart-1', filters: null, create_user: 1 },
        artifact: { artifact_id: 'art-1', object_key: 'downloads/dl-1' }
      });

      const schemaLookup = new Map<string, CsvPropertyDefinition[]>();
      schemaLookup.set('observation', [{ feature_property_name: 'count', feature_property_type_name: 'number' }]);
      schemaLookup.set('survey', [{ feature_property_name: 'name', feature_property_type_name: 'string' }]);
      schemaLookup.set('dataset', [{ feature_property_name: 'title', feature_property_type_name: 'string' }]);

      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup,
        featureTypes: ['observation', 'survey', 'dataset']
      });

      sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();
      sinon.stub(DownloadPipelineService.prototype, 'finalizeParquetDownload').resolves();

      await processDownloadJobHandler([createMockJob('dl-1')]);

      // 1 (findDownload) + 1 (updateStatus) + 1 (metadata) + 1 (schema) + 3 (per-type writes) + 1 (finalize) = 8
      expect((mockDBConnection.open as sinon.SinonStub).callCount).to.equal(8);
      expect((mockDBConnection.commit as sinon.SinonStub).callCount).to.equal(8);
      expect((mockDBConnection.release as sinon.SinonStub).callCount).to.equal(8);
    });

    it('passes correct properties from schemaLookup to writeFeatureTypeParquet', async () => {
      // Verifies: Each feature type receives its own property definitions from the schema
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves({
        download_id: 'dl-1',
        download_status: DownloadStatusEnum.PENDING,
        format: 'parquet',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        total_fragments: 0,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        fragment_size_bytes: '104857600',
        create_date: '2025-01-01T00:00:00Z'
      });

      sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();

      const source = { cart_id: 'cart-1', filters: null, create_user: 1 };
      const artifact = { artifact_id: 'art-1', object_key: 'downloads/dl-1' };
      sinon.stub(DownloadPipelineService.prototype, 'getDownloadMetadata').resolves({ source, artifact });

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
        featureTypes: ['observation', 'survey']
      });

      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();
      sinon.stub(DownloadPipelineService.prototype, 'finalizeParquetDownload').resolves();

      await processDownloadJobHandler([createMockJob('dl-1')]);

      // First call: observation with its properties
      expect(writeStub.firstCall.args[0]).to.equal('dl-1');
      expect(writeStub.firstCall.args[3]).to.deep.equal(obsProps);
      expect(writeStub.firstCall.args[4]).to.equal('observation');

      // Second call: survey with its properties
      expect(writeStub.secondCall.args[0]).to.equal('dl-1');
      expect(writeStub.secondCall.args[3]).to.deep.equal(surveyProps);
      expect(writeStub.secondCall.args[4]).to.equal('survey');
    });

    it('passes empty array when feature type has no schema entry', async () => {
      // Verifies: Missing schema entry defaults to empty properties (schemaLookup.get() ?? [])
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves({
        download_id: 'dl-1',
        download_status: DownloadStatusEnum.PENDING,
        format: 'parquet',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        total_fragments: 0,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        fragment_size_bytes: '104857600',
        create_date: '2025-01-01T00:00:00Z'
      });

      sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();
      sinon.stub(DownloadPipelineService.prototype, 'getDownloadMetadata').resolves({
        source: { cart_id: 'cart-1', filters: null, create_user: 1 },
        artifact: { artifact_id: 'art-1', object_key: 'downloads/dl-1' }
      });

      // Schema lookup has no entry for 'unknown_type'
      const schemaLookup = new Map<string, CsvPropertyDefinition[]>();
      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup,
        featureTypes: ['unknown_type']
      });

      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();
      sinon.stub(DownloadPipelineService.prototype, 'finalizeParquetDownload').resolves();

      await processDownloadJobHandler([createMockJob('dl-1')]);

      expect(writeStub.firstCall.args[3]).to.deep.equal([]);
      expect(writeStub.firstCall.args[4]).to.equal('unknown_type');
    });
  });

  describe('processDownloadJobHandler — error handling', () => {
    it('re-throws parquet pipeline errors for pg-boss retry', async () => {
      // Verifies: Errors propagate to pg-boss for automatic retry
      const mockDBConnection = setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves({
        download_id: 'dl-1',
        download_status: DownloadStatusEnum.PENDING,
        format: 'parquet',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        total_fragments: 0,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        fragment_size_bytes: '104857600',
        create_date: '2025-01-01T00:00:00Z'
      });

      sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();

      const testError = new Error('S3 upload failed');
      sinon.stub(DownloadPipelineService.prototype, 'getDownloadMetadata').rejects(testError);

      try {
        await processDownloadJobHandler([createMockJob('dl-1')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }

      // withConnection rolls back the failed phase
      expect((mockDBConnection.rollback as sinon.SinonStub).called).to.be.true;
    });

    it('re-throws fragment pipeline errors for pg-boss retry', async () => {
      // Verifies: Fragment pipeline errors still propagate after format branching
      const mockDBConnection = setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves({
        download_id: 'dl-1',
        download_status: DownloadStatusEnum.PENDING,
        format: 'csv',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        total_fragments: 0,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        fragment_size_bytes: '104857600',
        create_date: '2025-01-01T00:00:00Z'
      });

      const testError = new Error('Fragment planning failed');
      sinon.stub(DownloadPipelineService.prototype, 'planDownloadIfNeeded').rejects(testError);

      try {
        await processDownloadJobHandler([createMockJob('dl-1')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }

      expect((mockDBConnection.rollback as sinon.SinonStub).called).to.be.true;
    });
  });

  describe('processDownloadJobHandler — fragment pipeline (regression)', () => {
    it('calls each phase with correct downloadId', async () => {
      // Verifies: Handler orchestrates plan → process → finalize with correct downloadId
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves({
        download_id: 'aaaa0000-0000-0000-0000-000000000123',
        download_status: DownloadStatusEnum.PENDING,
        format: 'csv',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        total_fragments: 0,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        fragment_size_bytes: '104857600',
        create_date: '2025-01-01T00:00:00Z'
      });

      const planStub = sinon.stub(DownloadPipelineService.prototype, 'planDownloadIfNeeded').resolves();
      sinon.stub(DownloadPipelineService.prototype, 'getFragmentsToProcess').resolves([]);
      sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();
      const finalizeStub = sinon.stub(DownloadPipelineService.prototype, 'finalizeDownload').resolves();

      const mockJobs = [createMockJob('aaaa0000-0000-0000-0000-000000000123', 'job-abc')];
      await processDownloadJobHandler(mockJobs);

      expect(planStub).to.have.been.calledOnce;
      expect(planStub.firstCall.args[0]).to.equal('aaaa0000-0000-0000-0000-000000000123');
      expect(finalizeStub).to.have.been.calledOnce;
      expect(finalizeStub.firstCall.args[0]).to.equal('aaaa0000-0000-0000-0000-000000000123');
    });

    it('sets download status to PROCESSING before processing fragments', async () => {
      // Verifies: started_at is populated by setting PROCESSING status before fragment loop
      setupMockConnection();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves({
        download_id: 'aaaa0000-0000-0000-0000-000000000123',
        download_status: DownloadStatusEnum.PENDING,
        format: 'csv',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        total_fragments: 0,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        fragment_size_bytes: '104857600',
        create_date: '2025-01-01T00:00:00Z'
      });

      sinon.stub(DownloadPipelineService.prototype, 'planDownloadIfNeeded').resolves();
      sinon.stub(DownloadPipelineService.prototype, 'getFragmentsToProcess').resolves([]);
      const updateStatusStub = sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();
      sinon.stub(DownloadPipelineService.prototype, 'finalizeDownload').resolves();

      const mockJobs = [createMockJob('aaaa0000-0000-0000-0000-000000000123')];
      await processDownloadJobHandler(mockJobs);

      expect(updateStatusStub).to.have.been.calledOnce;
      expect(updateStatusStub.firstCall.args[0]).to.equal('aaaa0000-0000-0000-0000-000000000123');
      expect(updateStatusStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
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

    it('updates status to failed using downloadId', async () => {
      // Verifies: DLQ handler uses downloadId to update status to failed
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusByIdStub = sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();

      const mockJobs = [createMockFailedJob('aaaa0000-0000-0000-0000-000000000123', 'dlq-job-id')];
      await processDownloadFailedHandler(mockJobs);

      expect(updateStatusByIdStub).to.have.been.calledOnce;
      expect(updateStatusByIdStub.firstCall.args[0]).to.equal('aaaa0000-0000-0000-0000-000000000123');
      expect(updateStatusByIdStub.firstCall.args[1]).to.equal(DownloadStatusEnum.FAILED);
    });

    it('passes string error from job output when available', async () => {
      // Verifies: Handler extracts string error from job output
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusByIdStub = sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();

      const errorOutput = 'Database connection failed';
      const mockJobs = [createMockFailedJob('aaaa0000-0000-0000-0000-000000000123', 'dlq-job-id', errorOutput)];
      await processDownloadFailedHandler(mockJobs);

      expect(updateStatusByIdStub.firstCall.args[2]).to.deep.equal({ error: 'Database connection failed' });
    });

    it('uses default error message when job output is not a string', async () => {
      // Verifies: Handler uses default message when output is null/object
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusByIdStub = sinon.stub(DownloadPipelineService.prototype, 'updateDownloadStatus').resolves();

      const mockJobs = [createMockFailedJob('aaaa0000-0000-0000-0000-000000000123', 'dlq-job-id', { some: 'object' })];
      await processDownloadFailedHandler(mockJobs);

      expect(updateStatusByIdStub.firstCall.args[2]).to.deep.equal({
        error: 'Job failed after all retries'
      });
    });
  });
});
