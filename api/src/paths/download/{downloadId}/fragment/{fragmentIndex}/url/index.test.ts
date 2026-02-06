import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getFragmentUrl } from '.';
import * as db from '../../../../../../database/db';
import { HTTPError } from '../../../../../../errors/http-error';
import { DownloadService } from '../../../../../../services/download-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';

chai.use(sinonChai);

describe('paths/download/{downloadId}/fragment/{fragmentIndex}/url/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getFragmentUrl', () => {
    it('should return 200 with signed URL when download is ready and user owns it', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 1,
        system_user_id: 5,
        download_status: 'ready'
      };

      sinon.stub(DownloadService.prototype, 'getDownloadById').resolves(mockDownload as any);
      sinon.stub(DownloadService.prototype, 'getFragmentSignedUrl').resolves('https://s3.example.com/signed-url');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.system_user = { system_user_id: 5 } as any;
      mockReq.params = { downloadId: '1', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ url: 'https://s3.example.com/signed-url' });
    });

    it('should throw HTTP404 when download not found', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getDownloadById').resolves(null);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.system_user = { system_user_id: 5 } as any;
      mockReq.params = { downloadId: '999', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(404);
        expect((error as HTTPError).message).to.equal('Download not found');
      }
    });

    it('should throw HTTP403 when user does not own the download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 1,
        system_user_id: 99
      };

      sinon.stub(DownloadService.prototype, 'getDownloadById').resolves(mockDownload as any);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.system_user = { system_user_id: 5 } as any;
      mockReq.params = { downloadId: '1', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }
    });

    it('should throw HTTP409 when download is not ready', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 1,
        system_user_id: 5,
        download_status: 'processing'
      };

      sinon.stub(DownloadService.prototype, 'getDownloadById').resolves(mockDownload as any);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.system_user = { system_user_id: 5 } as any;
      mockReq.params = { downloadId: '1', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(409);
        expect((error as HTTPError).message).to.equal('Download is not ready');
      }
    });
  });
});
