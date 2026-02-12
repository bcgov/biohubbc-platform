import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { findDownloadById } from '.';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { DownloadService } from '../../../services/download-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';

chai.use(sinonChai);

describe('paths/download/{downloadId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findDownloadById', () => {
    it('should return 200 with download details and fragments when user owns download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: 5,
        download_status: 'ready',
        file_name: 'download-aaaa0000-0000-0000-0000-000000000001.zip',
        file_size_bytes: 12345,
        total_fragments: 1,
        completed_fragments: 1,
        estimated_total_size_bytes: 12000,
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:01:00Z',
        downloaded_at: null
      };

      const mockFragments = [
        {
          fragment_index: 0,
          fragment_status: 'ready',
          file_name: 'download-aaaa0000-0000-0000-0000-000000000001.zip',
          file_size_bytes: 12345,
          estimated_size_bytes: 12000,
          feature_count: 3,
          started_at: '2025-01-01T00:00:00Z',
          completed_at: '2025-01-01T00:01:00Z',
          error_message: null
        }
      ];

      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(mockDownload as any);
      sinon.stub(DownloadService.prototype, 'getFragmentsByDownloadId').resolves(mockFragments as any);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.system_user = { system_user_id: 5 } as any;
      mockReq.params = { downloadId: '1' };

      const requestHandler = findDownloadById();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        status: 'ready',
        file_name: 'download-aaaa0000-0000-0000-0000-000000000001.zip',
        file_size_bytes: 12345,
        total_fragments: 1,
        completed_fragments: 1,
        estimated_total_size_bytes: 12000,
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:01:00Z',
        downloaded_at: null,
        fragments: [
          {
            fragment_index: 0,
            status: 'ready',
            file_name: 'download-aaaa0000-0000-0000-0000-000000000001.zip',
            file_size_bytes: 12345,
            estimated_size_bytes: 12000,
            feature_count: 3,
            started_at: '2025-01-01T00:00:00Z',
            completed_at: '2025-01-01T00:01:00Z',
            error_message: null
          }
        ]
      });
    });

    it('should throw HTTP404 when download not found', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(null);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.system_user = { system_user_id: 5 } as any;
      mockReq.params = { downloadId: '999' };

      const requestHandler = findDownloadById();

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
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: 99
      };

      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(mockDownload as any);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.system_user = { system_user_id: 5 } as any;
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }
    });
  });
});
