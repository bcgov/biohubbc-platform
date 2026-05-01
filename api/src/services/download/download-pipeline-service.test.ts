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
import { FEATURE_PROPERTY_TYPE } from '../../models/feature-property';
import { FeatureTypeWithProperties } from '../../models/feature-type';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { CodeService } from '../code-service';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { SearchFeatureService } from '../search-feature-service';
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
  const TEST_SOURCE_CART: DownloadSource = {
    cart_id: 'cccc0000-0000-0000-0000-000000000001',
    filters: null,
    create_user: 1
  };
  const TEST_SOURCE_FILTER: DownloadSource = { cart_id: null, filters: { keyword: 'moose' }, create_user: 5 };

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

    it('resolves schema and feature types for cart-based downloads', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
      const listStub = sinon
        .stub(DownloadRepository.prototype, 'listDownloadFeatureTypesByCartId')
        .resolves(['dataset', 'observation']);

      const result = await service.resolveParquetSchema(TEST_DOWNLOAD_ID, TEST_SOURCE_CART);

      expect(listStub).to.have.been.calledOnceWith(TEST_SOURCE_CART.cart_id);
      expect(result.featureTypes).to.deep.equal(['dataset', 'observation']);
      expect(result.schemaLookup.has('dataset')).to.be.true;
      expect(result.schemaLookup.has('observation')).to.be.true;
    });

    it('resolves schema and feature types for filter-based downloads', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);
      const mockSubquery = { toSQL: () => ({ toNative: () => ({ sql: 'SELECT 1', bindings: [] }) }) } as any;
      const buildSubqueryStub = sinon
        .stub(SearchFeatureService.prototype, 'buildSearchFeatureIdsSubquery')
        .returns(mockSubquery);
      const listStub = sinon
        .stub(DownloadRepository.prototype, 'listDownloadFeatureTypesBySearchQuery')
        .resolves(['observation']);

      const result = await service.resolveParquetSchema(TEST_DOWNLOAD_ID, TEST_SOURCE_FILTER);

      expect(buildSubqueryStub).to.have.been.calledOnceWith(TEST_SOURCE_FILTER.filters, TEST_SOURCE_FILTER.create_user);
      expect(listStub).to.have.been.calledOnce;
      expect(result.featureTypes).to.deep.equal(['observation']);
    });

    it('throws when download has neither cart_id nor filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves(mockCodes);

      const noSource: DownloadSource = { cart_id: null, filters: null, create_user: 1 };

      try {
        await service.resolveParquetSchema(TEST_DOWNLOAD_ID, noSource);
        expect.fail('Expected an error');
      } catch (error) {
        expect((error as Error).message).to.include('has neither cart_id nor filters');
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
        .resolves({ artifact_id: 'bbbb0000-0000-0000-0000-000000000001' });
      const linkStub = sinon.stub(DownloadRepository.prototype, 'createDownloadArtifact').resolves();
      return { mockWriter, openStreamStub, uploadStub, insertArtifactStub, linkStub };
    };

    it('streams features to Parquet via cart path', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      const baseBatch = [
        {
          submission_feature_id: 1,
          uuid: 'uuid-1',
          feature_type_name: 'observation',
          data: { properties: {} },
          parent_uuid: 'p-1'
        }
      ];
      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([baseBatch]));
      sinon
        .stub(DownloadRepository.prototype, 'fetchTypedPropertyRows')
        .resolves([{ submission_feature_id: 1, name: 'species', value: 'bear' }]);

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE_CART,
        properties: mockProperties,
        featureTypeName: 'observation'
      });

      expect(mockWriter.appendRow).to.have.been.calledOnce;
      expect(mockWriter.close).to.have.been.calledOnce;
    });

    it('streams features to Parquet via filter path', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      const mockSubquery = {
        toSQL: () => ({ toNative: () => ({ sql: 'SELECT 1', bindings: [5] }) })
      } as any;
      sinon.stub(SearchFeatureService.prototype, 'buildSearchFeatureIdsSubquery').returns(mockSubquery);

      const baseBatch = [
        {
          submission_feature_id: 1,
          uuid: 'uuid-1',
          feature_type_name: 'observation',
          data: { properties: {} },
          parent_uuid: null
        }
      ];
      const streamStub = sinon
        .stub(DownloadRepository.prototype, 'streamFeatureBaseBySearchQueryAndType')
        .returns(mockBaseCursor([baseBatch]));
      sinon
        .stub(DownloadRepository.prototype, 'fetchTypedPropertyRows')
        .resolves([{ submission_feature_id: 1, name: 'species', value: 'moose' }]);

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE_FILTER,
        properties: mockProperties,
        featureTypeName: 'observation'
      });

      expect(streamStub).to.have.been.calledOnce;
      expect(streamStub.firstCall.args[0]).to.equal(TEST_DOWNLOAD_ID);
      expect(mockWriter.appendRow).to.have.been.calledOnce;
      expect(mockWriter.close).to.have.been.calledOnce;
    });

    it('uses deterministic S3 key downloads/{downloadId}/{featureTypeName}/data.parquet', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { uploadStub } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE_CART,
        properties: mockProperties,
        featureTypeName: 'observation'
      });

      expect(uploadStub).to.have.been.calledOnce;
      expect(uploadStub.firstCall.args[3]).to.equal(`downloads/${TEST_DOWNLOAD_ID}/observation/data.parquet`);
    });

    it('sets GeoParquet metadata on the writer when feature type has spatial properties', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE_CART,
        properties: mockSpatialProperties,
        featureTypeName: 'observation'
      });

      expect(mockWriter.setMetadata).to.have.been.calledOnce;
      expect(mockWriter.setMetadata.firstCall.args[0]).to.equal('geo');
      expect(mockWriter.setMetadata.firstCall.args[1]).to.be.a('string');
    });

    it('does not set GeoParquet metadata when feature type has no spatial properties', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { mockWriter } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE_CART,
        properties: mockProperties,
        featureTypeName: 'observation'
      });

      expect(mockWriter.setMetadata).to.not.have.been.called;
    });

    it('inserts artifact with uploaded status, parquet format, and deterministic S3 key', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { insertArtifactStub } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE_CART,
        properties: mockProperties,
        featureTypeName: 'observation'
      });

      expect(insertArtifactStub).to.have.been.calledOnce;
      const payload = insertArtifactStub.firstCall.args[0];
      expect(payload.artifact_status).to.equal('uploaded');
      expect(payload.format).to.equal('parquet');
      expect(payload.object_key).to.equal(`downloads/${TEST_DOWNLOAD_ID}/observation/data.parquet`);
      expect(payload.uploaded_at).to.be.a('string');
      expect(new Date(payload.uploaded_at!).toISOString()).to.equal(payload.uploaded_at);
    });

    it('inserts artifact with SHA-256 hex checksum and byte_size computed by the hash stream', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { insertArtifactStub, uploadStub } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE_CART,
        properties: mockProperties,
        featureTypeName: 'observation'
      });

      // uploadStream receives the hash-count transform (not the raw passThrough), proving the digest stream is in the pipeline
      expect(uploadStub).to.have.been.calledOnce;
      const uploadedStream = uploadStub.firstCall.args[1];
      expect(uploadedStream).to.exist;

      const payload = insertArtifactStub.firstCall.args[0];
      expect(payload.checksum_sha256).to.be.a('string');
      expect(payload.checksum_sha256).to.have.lengthOf(64);
      expect(payload.checksum_sha256).to.match(/^[0-9a-f]{64}$/);
      expect(payload.byte_size).to.equal(0); // zero-feature test → empty Parquet bytes piped via mock writer
    });

    it('inserts the download_artifact link after the artifact row is created', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadPipelineService(mockDBConnection);
      const { insertArtifactStub, linkStub } = stubParquetPipeline();

      sinon.stub(DownloadRepository.prototype, 'streamFeatureBaseByCartIdAndType').returns(mockBaseCursor([]));

      await service.writeFeatureTypeParquet({
        downloadId: TEST_DOWNLOAD_ID,
        source: TEST_SOURCE_CART,
        properties: mockProperties,
        featureTypeName: 'observation'
      });

      expect(insertArtifactStub).to.have.been.calledOnce;
      expect(linkStub).to.have.been.calledOnce;
      expect(linkStub.firstCall.args[0]).to.equal(TEST_DOWNLOAD_ID);
      expect(linkStub.firstCall.args[1]).to.equal('bbbb0000-0000-0000-0000-000000000001');
      expect(linkStub).to.have.been.calledAfter(insertArtifactStub);
    });
  });
});
