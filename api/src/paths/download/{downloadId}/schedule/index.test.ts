import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { disableDownloadSchedule, getDownloadSchedule, upsertDownloadSchedule } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { HTTP404, HTTPError } from '../../../../errors/http-error';
import { DownloadScheduleRecord } from '../../../../models/download-schedule';
import { DownloadScheduleService } from '../../../../services/download/download-schedule-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';

/**
 * Typed schedule fixture with all six DownloadScheduleRecord fields, so a field-name drift in the
 * route/model contract becomes a TypeScript error rather than a silent test pass.
 */
const makeScheduleRecord = (overrides: Partial<DownloadScheduleRecord> = {}): DownloadScheduleRecord => ({
  download_schedule_id: 1,
  download_id: DOWNLOAD_ID,
  cron_expression: '0 2 * * *',
  timezone: 'America/Vancouver',
  next_run_date: '2026-06-16T09:00:00.000Z',
  last_run_date: null,
  ...overrides
});

describe('paths/download/{downloadId}/schedule/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('upsertDownloadSchedule (POST)', () => {
    it('maps the body and path to upsertSchedule and returns 200 with the record', async () => {
      // Verifies: the POST threads (downloadId, { cron_expression }) into the service upsert and
      // returns the resulting record with a 200 (upsert, not 201). Authorization is a route-level
      // SystemRole gate, not a service argument.

      // Step 1: Stub the DB connection and the service upsert method
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const scheduleRecord = makeScheduleRecord();
      const upsertStub = sinon.stub(DownloadScheduleService.prototype, 'upsertSchedule').resolves(scheduleRecord);

      // Step 2: Send the request carrying the recurrence body
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };
      mockReq.body = { cron_expression: '0 2 * * *' };

      await upsertDownloadSchedule()(mockReq, mockRes, mockNext);

      // Step 3: Verify the service got the path id and the body straight through
      expect(upsertStub).to.have.been.calledOnceWith(DOWNLOAD_ID, {
        cron_expression: '0 2 * * *'
      });

      // Step 4: Verify the response (200 + the record)
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(scheduleRecord);
    });
  });

  describe('getDownloadSchedule (GET)', () => {
    it('maps the path to getActiveSchedule and returns 200 with the record', async () => {
      // Verifies: GET delegates to getActiveSchedule (threading downloadId) and returns the record.
      // The not-found-as-404 contract is the service's, covered there.

      // Step 1: Stub the DB connection and the active-schedule method
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const scheduleRecord = makeScheduleRecord();
      const getStub = sinon.stub(DownloadScheduleService.prototype, 'getActiveSchedule').resolves(scheduleRecord);

      // Step 2: Send the request
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };

      await getDownloadSchedule()(mockReq, mockRes, mockNext);

      // Step 3: Verify the service got the downloadId
      expect(getStub).to.have.been.calledOnceWith(DOWNLOAD_ID);

      // Step 4: Verify the response
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(scheduleRecord);
    });

    it('propagates HTTP404 from the service when there is no active schedule', async () => {
      // Verifies: a 404 from the service surfaces unchanged through the route (error pass-through).

      // Step 1: Stub the DB connection and reject from the service with a 404
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadScheduleService.prototype, 'getActiveSchedule')
        .rejects(new HTTP404('Download schedule not found'));

      // Step 2: Send the request and capture the error
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };

      try {
        await getDownloadSchedule()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        // Step 3: Verify the 404 propagated
        expect(error).to.be.instanceOf(HTTP404);
        expect((error as HTTPError).status).to.equal(404);
      }
    });
  });

  describe('disableDownloadSchedule (DELETE)', () => {
    it('maps the path to disableSchedule and returns 204 with no body', async () => {
      // Verifies: DELETE delegates to disableSchedule (threading downloadId) and returns 204 No
      // Content via res.status(204).send().

      // Step 1: Stub the DB connection and the disable method
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const disableStub = sinon.stub(DownloadScheduleService.prototype, 'disableSchedule').resolves();

      // Step 2: Send the request
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };

      await disableDownloadSchedule()(mockReq, mockRes, mockNext);

      // Step 3: Verify the service got the downloadId
      expect(disableStub).to.have.been.calledOnceWith(DOWNLOAD_ID);

      // Step 4: Verify the 204 result — status(204).send() sets statusValue, not sendStatusValue
      expect(mockRes.statusValue).to.equal(204);
    });
  });
});
