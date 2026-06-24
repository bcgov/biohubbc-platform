import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getDownloadPresignedUrl } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { HTTP403, HTTP404, HTTP409 } from '../../../../errors/http-error';
import { DownloadRecord } from '../../../../models/download';
import { DownloadStatusEnum } from '../../../../models/download-status';
import { DownloadService } from '../../../../services/download/download-service';

chai.use(sinonChai);

const makeDownloadRecord = (overrides: Partial<DownloadRecord> = {}): DownloadRecord => ({
  download_id: 'aaaa0000-0000-0000-0000-000000000001',
  download_version_id: 'dddd0000-0000-0000-0000-000000000002',
  download_status: DownloadStatusEnum.READY,
  format: 'parquet',
  metadata: null,
  started_at: '2026-01-01T00:00:00Z',
  completed_at: '2026-01-01T00:01:00Z',
  downloaded_at: null,
  create_date: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeParts = () => [
  {
    feature_type: 'Animal',
    url: 'https://s3.example.com/downloads/dl-1/Animal/data.parquet?sig=x',
    expires_at: '2026-01-01T00:30:00Z'
  }
];

describe('paths/download/{downloadId}/presigned-url', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getDownloadPresignedUrl', () => {
    it('returns 200 with parts for a READY download', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(makeDownloadRecord());
      sinon.stub(DownloadService.prototype, 'listDownloadParquetUrls').resolves(makeParts());

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const handler = getDownloadPresignedUrl();
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.deep.equal({
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        status: DownloadStatusEnum.READY,
        parts: makeParts()
      });
    });

    it('returns 200 with parts for a DOWNLOADED download', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(makeDownloadRecord({ download_status: DownloadStatusEnum.DOWNLOADED }));
      sinon.stub(DownloadService.prototype, 'listDownloadParquetUrls').resolves(makeParts());

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const handler = getDownloadPresignedUrl();
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
    });

    it('throws HTTP409 when download status is PENDING', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(makeDownloadRecord({ download_status: DownloadStatusEnum.PENDING }));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const handler = getDownloadPresignedUrl();

      try {
        await handler(mockReq, mockRes, mockNext);
        expect.fail('Expected HTTP409 to be thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }
    });

    it('throws HTTP409 when download status is PROCESSING', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(makeDownloadRecord({ download_status: DownloadStatusEnum.PROCESSING }));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const handler = getDownloadPresignedUrl();

      try {
        await handler(mockReq, mockRes, mockNext);
        expect.fail('Expected HTTP409 to be thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }
    });

    it('throws HTTP409 when download status is FAILED', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon
        .stub(DownloadService.prototype, 'getAuthorizedDownload')
        .resolves(makeDownloadRecord({ download_status: DownloadStatusEnum.FAILED }));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const handler = getDownloadPresignedUrl();

      try {
        await handler(mockReq, mockRes, mockNext);
        expect.fail('Expected HTTP409 to be thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }
    });

    it('propagates HTTP403 from getAuthorizedDownload when user is not a team member', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const handler = getDownloadPresignedUrl();

      try {
        await handler(mockReq, mockRes, mockNext);
        expect.fail('Expected HTTP403 to be thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });

    it('propagates HTTP404 from getAuthorizedDownload when download is missing', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP404('Download not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const handler = getDownloadPresignedUrl();

      try {
        await handler(mockReq, mockRes, mockNext);
        expect.fail('Expected HTTP404 to be thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP404);
      }
    });
  });
});
