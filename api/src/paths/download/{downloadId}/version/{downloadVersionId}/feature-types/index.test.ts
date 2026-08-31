import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getDownloadVersionFeatureTypes } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { DownloadExportService } from '../../../../../../services/download/download-export-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';

describe('paths/download/{downloadId}/version/{downloadVersionId}/feature-types/index', () => {
  afterEach(() => sinon.restore());

  it('returns exportable feature types for the selected version', async () => {
    const connection = getMockDBConnection({ systemUserId: () => 42 });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const featureTypes = [{ feature_type: 'observation', columns: ['uuid'] }];
    const getStub = sinon
      .stub(DownloadExportService.prototype, 'getDownloadVersionExportFeatureTypes')
      .resolves(featureTypes);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = 'token';
    mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };

    await getDownloadVersionFeatureTypes()(mockReq, mockRes, mockNext);

    expect(getStub).to.have.been.calledOnceWith(DOWNLOAD_ID, 42, VERSION_ID);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(featureTypes);
  });
});
