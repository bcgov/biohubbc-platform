import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { listDownloadVersionExports } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import {
  createMockDownloadVersionExportListRow,
  createMockDownloadVersionStatusRecord
} from '../../../../../../__mocks__/download';
import * as db from '../../../../../../database/db';
import { DownloadExportService } from '../../../../../../services/download/download-export-service';
import { DownloadService } from '../../../../../../services/download/download-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';

describe('paths/download/{downloadId}/version/{downloadVersionId}/export/index', () => {
  afterEach(() => sinon.restore());

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
