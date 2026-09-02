import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDownloadVersionExport, listDownloadVersionExports } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import {
  createMockDownloadVersionExportListRow,
  createMockDownloadVersionStatusRecord
} from '../../../../../../__mocks__/download';
import * as db from '../../../../../../database/db';
import { ApiValidationError } from '../../../../../../errors/api-error';
import { HTTP403 } from '../../../../../../errors/http-error';
import { DownloadVersionExportRecord } from '../../../../../../models/download-version-export';
import { DownloadExportService } from '../../../../../../services/download/download-export-service';
import { DownloadService } from '../../../../../../services/download/download-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';

const makeExportRecord = (): DownloadVersionExportRecord => {
  const row = createMockDownloadVersionExportListRow({ download_id: DOWNLOAD_ID });

  return {
    download_version_export_id: row.download_version_export_id,
    download_id: row.download_id,
    format: row.format,
    mode: row.mode,
    max_part_size_bytes: row.max_part_size_bytes,
    status: row.status,
    started_at: row.started_at,
    completed_at: row.completed_at,
    error_message: row.error_message
  };
};

describe('paths/download/{downloadId}/version/{downloadVersionId}/export/index', () => {
  afterEach(() => sinon.restore());

  describe('createDownloadVersionExport (POST)', () => {
    it('adds the route downloadVersionId to the config body before calling the service', async () => {
      const connection = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const exportRecord = makeExportRecord();
      const createStub = sinon
        .stub(DownloadExportService.prototype, 'createDownloadVersionExport')
        .resolves(exportRecord);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };
      mockReq.body = {
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['observation'],
        merge_steps: []
      };

      await createDownloadVersionExport()(mockReq, mockRes, mockNext);

      expect(createStub).to.have.been.calledOnceWith(
        DOWNLOAD_ID,
        42,
        {
          ...mockReq.body,
          download_version_id: VERSION_ID,
          max_part_size_bytes: undefined
        },
        connection
      );
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(exportRecord);
    });

    it('lets the route downloadVersionId override any body download_version_id and widens max_part_size_bytes', async () => {
      const connection = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const createStub = sinon
        .stub(DownloadExportService.prototype, 'createDownloadVersionExport')
        .resolves(createMockDownloadVersionExportListRow({ download_id: DOWNLOAD_ID }));
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };
      mockReq.body = {
        download_version_id: 'dddd0000-0000-0000-0000-000000000099',
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['observation'],
        merge_steps: [],
        max_part_size_bytes: 10485760
      };

      await createDownloadVersionExport()(mockReq, mockRes, mockNext);

      expect(createStub.firstCall.args[2]).to.deep.equal({
        ...mockReq.body,
        download_version_id: VERSION_ID,
        max_part_size_bytes: '10485760'
      });
    });

    it('does not publish at the route layer because the service owns enqueueing', async () => {
      const connection = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const publishStub = sinon.stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob');
      sinon
        .stub(DownloadExportService.prototype, 'createDownloadVersionExport')
        .resolves(createMockDownloadVersionExportListRow({ download_id: DOWNLOAD_ID }));
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };
      mockReq.body = {
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['observation'],
        merge_steps: []
      };

      await createDownloadVersionExport()(mockReq, mockRes, mockNext);

      expect(publishStub).to.not.have.been.called;
    });

    it('propagates service errors and rolls back the transaction', async () => {
      const connection = getMockDBConnection({
        systemUserId: () => 42,
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      sinon
        .stub(DownloadExportService.prototype, 'createDownloadVersionExport')
        .rejects(new ApiValidationError('invalid config', []));
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };
      mockReq.body = {
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['observation'],
        merge_steps: []
      };

      try {
        await createDownloadVersionExport()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiValidationError);
        expect(connection.rollback).to.have.been.calledOnce;
        expect(connection.release).to.have.been.calledOnce;
      }
    });

    it('propagates HTTP403 from the service', async () => {
      const connection = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      sinon.stub(DownloadExportService.prototype, 'createDownloadVersionExport').rejects(new HTTP403('Access denied'));
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };
      mockReq.body = {
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['observation'],
        merge_steps: []
      };

      try {
        await createDownloadVersionExport()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });
  });

  it('returns exports scoped to the selected version', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const rows = [createMockDownloadVersionExportListRow({ download_id: DOWNLOAD_ID })];
    const versionStub = sinon
      .stub(DownloadService.prototype, 'getDownloadVersion')
      .resolves(createMockDownloadVersionStatusRecord({ download_id: DOWNLOAD_ID, download_version_id: VERSION_ID }));
    const listStub = sinon.stub(DownloadExportService.prototype, 'listDownloadVersionExports').resolves(rows);
    const countStub = sinon.stub(DownloadExportService.prototype, 'listDownloadVersionExportsCount').resolves(1);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = 'token';
    mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };
    mockReq.query = { page: '1', limit: '10' };

    await listDownloadVersionExports()(mockReq, mockRes, mockNext);

    expect(versionStub).to.have.been.calledOnceWith(DOWNLOAD_ID, VERSION_ID);
    expect(listStub).to.have.been.calledOnceWith(
      DOWNLOAD_ID,
      { page: 1, limit: 10, sort: undefined, order: undefined },
      VERSION_ID
    );
    expect(countStub).to.have.been.calledOnceWith(DOWNLOAD_ID, VERSION_ID);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.exports).to.eql(rows);
  });
});
