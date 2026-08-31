import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getDownloadPresignedUrl } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { HTTP409 } from '../../../../errors/http-error';
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
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

      sinon.stub(DownloadService.prototype, 'listDownloadParquetUrls').resolves(makeParts());
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(makeDownloadRecord());

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
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

      sinon.stub(DownloadService.prototype, 'listDownloadParquetUrls').resolves(makeParts());
      sinon
        .stub(DownloadService.prototype, 'findDownloadById')
        .resolves(makeDownloadRecord({ download_status: DownloadStatusEnum.DOWNLOADED }));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const handler = getDownloadPresignedUrl();
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
    });

    it('throws HTTP409 when download status is PENDING', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadService.prototype, 'findDownloadById')
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
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadService.prototype, 'findDownloadById')
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
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadService.prototype, 'findDownloadById')
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
  });
});
