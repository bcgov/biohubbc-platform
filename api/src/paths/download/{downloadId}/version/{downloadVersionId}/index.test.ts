import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getDownloadVersion } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { createMockDownloadVersionStatusRecord } from '../../../../../__mocks__/download';
import * as db from '../../../../../database/db';
import { DownloadService } from '../../../../../services/download/download-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';

describe('paths/download/{downloadId}/version/{downloadVersionId}/index', () => {
  afterEach(() => sinon.restore());

  it('returns the requested version from the parent-scoped service', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
    const version = createMockDownloadVersionStatusRecord({
      download_id: DOWNLOAD_ID,
      download_version_id: VERSION_ID
    });
    const getStub = sinon.stub(DownloadService.prototype, 'getDownloadVersion').resolves(version);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = 'token';
    mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };

    await getDownloadVersion()(mockReq, mockRes, mockNext);

    expect(getStub).to.have.been.calledOnceWith(DOWNLOAD_ID, VERSION_ID);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(version);
  });
});
