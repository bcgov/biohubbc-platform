import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { DownloadScheduleRecord } from '../../models/download-schedule';
import { DownloadScheduleRepository } from './download-schedule-repository';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000042';
const SCHEDULE_ID = 7;
const NEXT_RUN_DATE = '2026-06-16T02:00:00.000Z';

// Typed with the Zod-inferred record so happy-path mock rows match what the repository returns.
const mockScheduleRecord: DownloadScheduleRecord = {
  download_schedule_id: SCHEDULE_ID,
  download_id: DOWNLOAD_ID,
  cron_expression: '0 2 * * *',
  timezone: 'America/Vancouver',
  next_run_date: NEXT_RUN_DATE,
  last_run_date: null
};

describe('DownloadScheduleRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  // findActiveScheduleByDownloadId (pure rows[0] ?? null) and claimDueSchedules (pass-through read with
  // FOR UPDATE SKIP LOCKED + now()/active filters) carry no unit-testable decision — their real behavior
  // (constraints, now()-relative filters, SKIP LOCKED) is covered by the Phase 5 DB integration suite.

  describe('createDownloadSchedule', () => {
    it('INSERTs into download_schedule, RETURNs the columns, and binds the payload', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([mockScheduleRecord], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadScheduleRepository(mockDBConnection);

      await repo.createDownloadSchedule({
        download_id: DOWNLOAD_ID,
        cron_expression: '0 2 * * *',
        timezone: 'America/Vancouver',
        next_run_date: NEXT_RUN_DATE
      });

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('INSERT INTO download_schedule');
      expect(sqlText).to.include('RETURNING');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DOWNLOAD_ID);
      expect(sqlValues).to.include(NEXT_RUN_DATE);
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadScheduleRepository(mockDBConnection);

      try {
        await repo.createDownloadSchedule({
          download_id: DOWNLOAD_ID,
          cron_expression: '0 2 * * *',
          timezone: 'America/Vancouver',
          next_run_date: NEXT_RUN_DATE
        });
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to insert download schedule record');
      }
    });
  });

  describe('updateDownloadSchedule', () => {
    it('UPDATEs the recurrence scoped to active rows and does not touch last_run_date', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([mockScheduleRecord], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadScheduleRepository(mockDBConnection);

      await repo.updateDownloadSchedule(SCHEDULE_ID, {
        cron_expression: '0 3 * * *',
        timezone: 'UTC',
        next_run_date: NEXT_RUN_DATE
      });

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('UPDATE download_schedule');
      expect(sqlText).to.include('record_end_date IS NULL');
      // The SET clause must not assign last_run_date (an update re-points the recurrence, not run history).
      // last_run_date still appears in the RETURNING clause, so only the assignment is asserted absent.
      expect(sqlText).to.not.match(/last_run_date\s*=/);

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(SCHEDULE_ID);
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadScheduleRepository(mockDBConnection);

      try {
        await repo.updateDownloadSchedule(SCHEDULE_ID, {
          cron_expression: '0 3 * * *',
          timezone: 'UTC',
          next_run_date: NEXT_RUN_DATE
        });
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to update download schedule record');
      }
    });
  });

  describe('disableSchedule', () => {
    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadScheduleRepository(mockDBConnection);

      try {
        await repo.disableSchedule(SCHEDULE_ID);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to disable download schedule record');
      }
    });
  });

  describe('markRun', () => {
    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadScheduleRepository(mockDBConnection);

      try {
        await repo.markRun(SCHEDULE_ID, NEXT_RUN_DATE);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to mark download schedule run');
      }
    });
  });
});
