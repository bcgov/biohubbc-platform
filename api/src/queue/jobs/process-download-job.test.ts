import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockDownloadVersionStatusRecord } from '../../__mocks__/download';
import * as db from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { PolicyEffect } from '../../models/policy-statement';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
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

  const DOWNLOAD_VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';
  const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000042';

  const createMockJob = (downloadVersionId: string, jobId = 'test-job-id') =>
    ({
      id: jobId,
      name: 'process-download',
      data: { downloadVersionId }
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

  const createMockStatement = (urn_feature_type: string, expression_id: string | null = null) => ({
    policy_statement_id: `psid-${urn_feature_type}`,
    effect: PolicyEffect.ALLOW,
    urn_feature_type,
    expression_id
  });

  describe('processDownloadJobHandler', () => {
    it('transitions pending → processing → ready for a version with 3 feature types', async () => {
      setupMockConnection();

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord());

      const transitionStub = sinon
        .stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus')
        .resolves();
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

      await processDownloadJobHandler([createMockJob(DOWNLOAD_VERSION_ID)]);

      // Two status transitions, both keyed on the version id: first to PROCESSING, then to READY
      expect(transitionStub).to.have.been.calledTwice;
      expect(transitionStub.firstCall.args[0]).to.equal(DOWNLOAD_VERSION_ID);
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      expect(transitionStub.firstCall.args[2]).to.deep.equal([
        DownloadStatusEnum.PENDING,
        DownloadStatusEnum.PROCESSING
      ]);

      expect(transitionStub.secondCall.args[0]).to.equal(DOWNLOAD_VERSION_ID);
      expect(transitionStub.secondCall.args[1]).to.equal(DownloadStatusEnum.READY);
      expect(transitionStub.secondCall.args[2]).to.deep.equal([DownloadStatusEnum.PROCESSING]);

      // writeFeatureTypeParquet called once per statement, in statements order. Each payload
      // threads the version id and the owning download id (derived from the version's download_id).
      expect(writeStub).to.have.been.calledThrice;
      expect(writeStub.firstCall.args[0]).to.deep.include({
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        source,
        featureTypeName: 'a',
        statement: statements[0]
      });
      expect(writeStub.secondCall.args[0]).to.deep.include({
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        source,
        featureTypeName: 'b',
        statement: statements[1]
      });
      expect(writeStub.thirdCall.args[0]).to.deep.include({
        downloadId: DOWNLOAD_ID,
        downloadVersionId: DOWNLOAD_VERSION_ID,
        source,
        featureTypeName: 'c',
        statement: statements[2]
      });
    });

    it('derives downloadId for the parquet write from the version row download_id', async () => {
      setupMockConnection();

      // A version that names a specific owning download — the handler must thread that exact
      // download_id (not the version id) into the parquet write so the S3 key/source resolve correctly.
      const versionDownloadId = 'bbbb0000-0000-0000-0000-000000000099';
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord({ download_id: versionDownloadId }));

      sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus').resolves();
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

      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();

      await processDownloadJobHandler([createMockJob(DOWNLOAD_VERSION_ID)]);

      expect(writeStub).to.have.been.calledOnce;
      expect(writeStub.firstCall.args[0].downloadId).to.equal(versionDownloadId);
      expect(writeStub.firstCall.args[0].downloadVersionId).to.equal(DOWNLOAD_VERSION_ID);
    });

    it('calls writeFeatureTypeParquet with the properties looked up from schemaLookup for each feature type', async () => {
      setupMockConnection();

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord());
      sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus').resolves();
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

      await processDownloadJobHandler([createMockJob(DOWNLOAD_VERSION_ID)]);

      expect(writeStub.firstCall.args[0].featureTypeName).to.equal('observation');
      expect(writeStub.firstCall.args[0].properties).to.deep.equal(obsProps);

      expect(writeStub.secondCall.args[0].featureTypeName).to.equal('survey');
      expect(writeStub.secondCall.args[0].properties).to.deep.equal(surveyProps);
    });

    it('skips writeFeatureTypeParquet and still transitions to READY when featureTypes is empty', async () => {
      setupMockConnection();

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord());
      const transitionStub = sinon
        .stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus')
        .resolves();
      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ policy_id: '11111111-1111-1111-1111-111111111111', requested_by: 1 });
      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup: new Map<string, CsvPropertyDefinition[]>(),
        featureTypes: [],
        statements: []
      });

      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();

      await processDownloadJobHandler([createMockJob(DOWNLOAD_VERSION_ID)]);

      expect(writeStub).to.not.have.been.called;

      // Still transitioned pending → processing and processing → ready
      expect(transitionStub).to.have.been.calledTwice;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
      expect(transitionStub.secondCall.args[1]).to.equal(DownloadStatusEnum.READY);
    });

    it('enters processing cleanly when a mid-job retry finds the version already in PROCESSING', async () => {
      setupMockConnection();

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.PROCESSING }));

      const transitionStub = sinon
        .stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus')
        .resolves();
      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ policy_id: '11111111-1111-1111-1111-111111111111', requested_by: 1 });
      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup: new Map<string, CsvPropertyDefinition[]>(),
        featureTypes: [],
        statements: []
      });

      await processDownloadJobHandler([createMockJob(DOWNLOAD_VERSION_ID)]);

      expect(transitionStub).to.have.been.calledTwice;
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.PROCESSING);
    });

    for (const terminalStatus of [DownloadStatusEnum.READY, DownloadStatusEnum.FAILED, DownloadStatusEnum.DOWNLOADED]) {
      it(`skips silently with no throw when version status is terminal (${terminalStatus})`, async () => {
        setupMockConnection();

        sinon
          .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
          .resolves(createMockDownloadVersionStatusRecord({ status: terminalStatus }));

        const transitionStub = sinon
          .stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus')
          .resolves();
        const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();

        // Must resolve without throwing — a re-fired terminal job is a silent no-op, not a DLQ candidate.
        await processDownloadJobHandler([createMockJob(DOWNLOAD_VERSION_ID)]);

        // No work done — guard returned early
        expect(transitionStub).to.not.have.been.called;
        expect(writeStub).to.not.have.been.called;
      });
    }

    it('propagates the not-found error when the version does not exist', async () => {
      setupMockConnection();

      // The handler has no null-guard of its own — the repository's get* throws on a miss,
      // and that error propagates so the job lands in the DLQ.
      const notFoundError = new Error('Download version not found');
      sinon.stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById').rejects(notFoundError);

      const transitionStub = sinon
        .stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus')
        .resolves();
      const writeStub = sinon.stub(DownloadPipelineService.prototype, 'writeFeatureTypeParquet').resolves();

      try {
        await processDownloadJobHandler([createMockJob(DOWNLOAD_VERSION_ID)]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(notFoundError);
      }

      expect(transitionStub).to.not.have.been.called;
      expect(writeStub).to.not.have.been.called;
    });

    it('propagates error from writeFeatureTypeParquet without transitioning to READY', async () => {
      setupMockConnection();

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord());
      const transitionStub = sinon
        .stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus')
        .resolves();
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
        await processDownloadJobHandler([createMockJob(DOWNLOAD_VERSION_ID)]);
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

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord());
      sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus').resolves();
      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ policy_id: '11111111-1111-1111-1111-111111111111', requested_by: null });
      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup: new Map<string, CsvPropertyDefinition[]>(),
        featureTypes: [],
        statements: []
      });

      await processDownloadJobHandler([createMockJob(DOWNLOAD_VERSION_ID)]);

      expect(sendStub).to.not.have.been.called;
    });

    it('does not auto-enqueue an export for an authenticated download (requested_by set)', async () => {
      setupMockConnection();
      const sendStub = stubPgBoss();

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord());
      sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus').resolves();
      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ policy_id: '11111111-1111-1111-1111-111111111111', requested_by: 42 });
      sinon.stub(DownloadPipelineService.prototype, 'resolveParquetSchema').resolves({
        schemaLookup: new Map<string, CsvPropertyDefinition[]>(),
        featureTypes: [],
        statements: []
      });

      await processDownloadJobHandler([createMockJob(DOWNLOAD_VERSION_ID)]);

      expect(sendStub).to.not.have.been.called;
    });
  });

  describe('processDownloadFailedHandler', () => {
    const createMockFailedJob = (downloadVersionId: string, jobId = 'dlq-job-id', output?: unknown) =>
      ({
        id: jobId,
        name: '__state__completed__process-download',
        data: { downloadVersionId },
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

    it('transitions the version to failed with error metadata for a string job output', async () => {
      setupDLQMocks();

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.PROCESSING }));

      const transitionStub = sinon
        .stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus')
        .resolves();

      await processDownloadFailedHandler([
        createMockFailedJob(DOWNLOAD_VERSION_ID, 'dlq-job-id', 'something went wrong')
      ]);

      expect(transitionStub).to.have.been.calledOnce;
      expect(transitionStub.firstCall.args[0]).to.equal(DOWNLOAD_VERSION_ID);
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
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.PROCESSING }));

      const transitionStub = sinon
        .stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus')
        .resolves();

      await processDownloadFailedHandler([createMockFailedJob(DOWNLOAD_VERSION_ID, 'dlq-job-id', { whatever: 'obj' })]);

      expect(transitionStub.firstCall.args[3]).to.deep.equal({ error: 'Job failed after all retries' });
    });

    for (const terminalStatus of [DownloadStatusEnum.READY, DownloadStatusEnum.FAILED, DownloadStatusEnum.DOWNLOADED]) {
      it(`skips silently when the version is already in terminal status (${terminalStatus})`, async () => {
        const { commitStub, rollbackStub } = setupDLQMocks();

        sinon
          .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
          .resolves(createMockDownloadVersionStatusRecord({ status: terminalStatus }));

        const transitionStub = sinon
          .stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus')
          .resolves();

        await processDownloadFailedHandler([createMockFailedJob(DOWNLOAD_VERSION_ID, 'dlq-job-id', 'anything')]);

        expect(transitionStub).to.not.have.been.called;
        expect(commitStub).to.have.been.calledOnce;
        expect(rollbackStub).to.not.have.been.called;
      });
    }

    it('rethrows unexpected errors from transitionDownloadVersionStatus', async () => {
      const { commitStub, rollbackStub } = setupDLQMocks();

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersionStatusById')
        .resolves(createMockDownloadVersionStatusRecord({ status: DownloadStatusEnum.PROCESSING }));

      const testError = new Error('unexpected');
      sinon.stub(DownloadPipelineService.prototype, 'transitionDownloadVersionStatus').rejects(testError);

      try {
        await processDownloadFailedHandler([createMockFailedJob(DOWNLOAD_VERSION_ID, 'dlq-job-id', 'anything')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }

      expect(rollbackStub).to.have.been.calledOnce;
      expect(commitStub).to.not.have.been.called;
    });
  });
});
