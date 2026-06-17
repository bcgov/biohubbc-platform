import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockDownloadVersion } from '../../__mocks__/download';
import { HTTP400, HTTP404 } from '../../errors/http-error';
import { DownloadScheduleRecord } from '../../models/download-schedule';
import { DownloadScheduleRepository } from '../../repositories/download/download-schedule-repository';
import { DownloadScheduleService } from './download-schedule-service';
import { DownloadService } from './download-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VALID_CRON = '0 2 * * *';
// The zone the service fixes server-side (mirrors SCHEDULE_TIMEZONE in the service) — callers no
// longer supply it, so the persisted payload must always carry this value.
const SCHEDULE_TZ = 'America/Vancouver';

/**
 * Build a DownloadScheduleRecord with sensible defaults; callers override fields that matter for
 * the specific test.
 */
const createMockSchedule = (overrides: Partial<DownloadScheduleRecord> = {}): DownloadScheduleRecord => ({
  download_schedule_id: 1,
  download_id: DOWNLOAD_ID,
  cron_expression: VALID_CRON,
  timezone: SCHEDULE_TZ,
  next_run_date: '2026-06-16T02:00:00.000Z',
  last_run_date: null,
  ...overrides
});

const validRequest = (overrides: Record<string, string> = {}) => ({
  cron_expression: VALID_CRON,
  ...overrides
});

describe('DownloadScheduleService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('upsertSchedule', () => {
    it('throws HTTP404 when the parent download does not exist, before any schedule read or write', async () => {
      // Verifies: the existence check runs before anything else — a missing download short-circuits
      // before any schedule state is read or written (and before an FK violation could surface).
      // Authorization itself is a route-level SystemRole gate, not the service's concern.
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(null);
      const findStub = sinon.stub(DownloadScheduleRepository.prototype, 'findActiveScheduleByDownloadId');
      const createStub = sinon.stub(DownloadScheduleRepository.prototype, 'createDownloadSchedule');
      const updateStub = sinon.stub(DownloadScheduleRepository.prototype, 'updateDownloadSchedule');

      const service = new DownloadScheduleService(getMockDBConnection());
      try {
        await service.upsertSchedule(DOWNLOAD_ID, validRequest());
        expect.fail('Expected throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP404);
      }

      expect(findStub).to.not.have.been.called;
      expect(createStub).to.not.have.been.called;
      expect(updateStub).to.not.have.been.called;
    });

    it('throws HTTP400 for an invalid cron expression before any repository write', async () => {
      // Verifies: invalid user input maps to a 400 at the system boundary, BEFORE any schedule read
      // or write happens (the parent download exists).
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves({} as never);
      const findStub = sinon.stub(DownloadScheduleRepository.prototype, 'findActiveScheduleByDownloadId');
      const createStub = sinon.stub(DownloadScheduleRepository.prototype, 'createDownloadSchedule');
      const updateStub = sinon.stub(DownloadScheduleRepository.prototype, 'updateDownloadSchedule');

      const service = new DownloadScheduleService(getMockDBConnection());
      try {
        await service.upsertSchedule(DOWNLOAD_ID, validRequest({ cron_expression: 'not a cron' }));
        expect.fail('Expected throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP400);
      }

      expect(findStub).to.not.have.been.called;
      expect(createStub).to.not.have.been.called;
      expect(updateStub).to.not.have.been.called;
    });

    it('creates a new schedule with a snake_case payload when no active schedule exists', async () => {
      // Verifies: no active row → create; the persisted payload is snake_case, threads the request
      // cron + the server-fixed timezone, carries a computed next_run_date, and no update fires.
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves({} as never);
      sinon.stub(DownloadScheduleRepository.prototype, 'findActiveScheduleByDownloadId').resolves(null);
      const created = createMockSchedule();
      const createStub = sinon.stub(DownloadScheduleRepository.prototype, 'createDownloadSchedule').resolves(created);
      const updateStub = sinon.stub(DownloadScheduleRepository.prototype, 'updateDownloadSchedule');

      const service = new DownloadScheduleService(getMockDBConnection());
      const result = await service.upsertSchedule(DOWNLOAD_ID, validRequest());

      expect(updateStub).to.not.have.been.called;
      expect(createStub).to.have.been.calledOnce;
      const payload = createStub.firstCall.args[0];
      expect(payload.download_id).to.equal(DOWNLOAD_ID);
      expect(payload.cron_expression).to.equal(VALID_CRON);
      expect(payload.timezone).to.equal(SCHEDULE_TZ);
      expect(payload.next_run_date).to.be.a('string').and.not.empty;
      expect(result).to.eql(created);
    });

    it('updates the existing active schedule by id when one exists, without creating a duplicate', async () => {
      // Verifies: an active row → update that row's id; the computed next_run_date is threaded into
      // the update payload and no create fires (the at-most-one-active-schedule rule).
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves({} as never);
      sinon
        .stub(DownloadScheduleRepository.prototype, 'findActiveScheduleByDownloadId')
        .resolves(createMockSchedule({ download_schedule_id: 7 }));
      const updated = createMockSchedule({ download_schedule_id: 7 });
      const updateStub = sinon.stub(DownloadScheduleRepository.prototype, 'updateDownloadSchedule').resolves(updated);
      const createStub = sinon.stub(DownloadScheduleRepository.prototype, 'createDownloadSchedule');

      const service = new DownloadScheduleService(getMockDBConnection());
      const result = await service.upsertSchedule(DOWNLOAD_ID, validRequest());

      expect(createStub).to.not.have.been.called;
      expect(updateStub).to.have.been.calledOnce;
      expect(updateStub.firstCall.args[0]).to.equal(7);
      const payload = updateStub.firstCall.args[1];
      expect(payload.cron_expression).to.equal(VALID_CRON);
      expect(payload.timezone).to.equal(SCHEDULE_TZ);
      expect(payload.next_run_date).to.be.a('string').and.not.empty;
      expect(result).to.eql(updated);
    });
  });

  describe('getActiveSchedule', () => {
    it('throws HTTP404 when there is no active schedule', async () => {
      sinon.stub(DownloadScheduleRepository.prototype, 'findActiveScheduleByDownloadId').resolves(null);

      const service = new DownloadScheduleService(getMockDBConnection());
      try {
        await service.getActiveSchedule(DOWNLOAD_ID);
        expect.fail('Expected throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP404);
      }
    });

    it('returns the active schedule when one exists', async () => {
      const schedule = createMockSchedule();
      sinon.stub(DownloadScheduleRepository.prototype, 'findActiveScheduleByDownloadId').resolves(schedule);

      const service = new DownloadScheduleService(getMockDBConnection());
      const result = await service.getActiveSchedule(DOWNLOAD_ID);

      expect(result).to.eql(schedule);
    });
  });

  describe('disableSchedule', () => {
    it('throws HTTP404 and does not disable when there is no active schedule', async () => {
      sinon.stub(DownloadScheduleRepository.prototype, 'findActiveScheduleByDownloadId').resolves(null);
      const disableStub = sinon.stub(DownloadScheduleRepository.prototype, 'disableSchedule');

      const service = new DownloadScheduleService(getMockDBConnection());
      try {
        await service.disableSchedule(DOWNLOAD_ID);
        expect.fail('Expected throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP404);
      }

      expect(disableStub).to.not.have.been.called;
    });

    it('disables the active schedule by its id when one exists', async () => {
      sinon
        .stub(DownloadScheduleRepository.prototype, 'findActiveScheduleByDownloadId')
        .resolves(createMockSchedule({ download_schedule_id: 9 }));
      const disableStub = sinon.stub(DownloadScheduleRepository.prototype, 'disableSchedule').resolves();

      const service = new DownloadScheduleService(getMockDBConnection());
      await service.disableSchedule(DOWNLOAD_ID);

      expect(disableStub).to.have.been.calledOnceWith(9);
    });
  });

  describe('runDueSchedules', () => {
    it('claims due schedules with the poll batch limit', async () => {
      const claimStub = sinon.stub(DownloadScheduleRepository.prototype, 'claimDueSchedules').resolves([]);

      const service = new DownloadScheduleService(getMockDBConnection());
      await service.runDueSchedules();

      expect(claimStub).to.have.been.calledOnceWith(100);
    });

    it('does nothing further when no schedules are due', async () => {
      sinon.stub(DownloadScheduleRepository.prototype, 'claimDueSchedules').resolves([]);
      const markRunStub = sinon.stub(DownloadScheduleRepository.prototype, 'markRun');
      const rerunStub = sinon.stub(DownloadService.prototype, 'rerunDownload');

      const service = new DownloadScheduleService(getMockDBConnection());
      await service.runDueSchedules();

      expect(markRunStub).to.not.have.been.called;
      expect(rerunStub).to.not.have.been.called;
    });

    it('advances each due schedule (markRun) before rerunning it, in system context (no per-user auth)', async () => {
      // Verifies: each due row is advanced past now() BEFORE its rerun fires (so a completed
      // occurrence can't re-fire next poll), the rerun targets the row's download id, and no
      // per-user authorization runs — this is the scheduler, not a user action.
      const rowA = { download_schedule_id: 1, download_id: 'dl-a', cron_expression: '0 2 * * *', timezone: 'UTC' };
      const rowB = {
        download_schedule_id: 2,
        download_id: 'dl-b',
        cron_expression: '0 5 * * *',
        timezone: 'America/Vancouver'
      };
      sinon.stub(DownloadScheduleRepository.prototype, 'claimDueSchedules').resolves([rowA, rowB]);
      const markRunStub = sinon.stub(DownloadScheduleRepository.prototype, 'markRun').resolves();
      const rerunStub = sinon.stub(DownloadService.prototype, 'rerunDownload').resolves(createMockDownloadVersion());
      const authStub = sinon.stub(DownloadService.prototype, 'getAuthorizedDownload');

      const service = new DownloadScheduleService(getMockDBConnection());
      await service.runDueSchedules();

      expect(markRunStub).to.have.been.calledTwice;
      expect(rerunStub).to.have.been.calledTwice;

      // Row A: markRun(1, <computed string>) before rerunDownload('dl-a')
      expect(markRunStub.firstCall.args[0]).to.equal(1);
      expect(markRunStub.firstCall.args[1]).to.be.a('string').and.not.empty;
      expect(rerunStub.firstCall.args[0]).to.equal('dl-a');
      expect(markRunStub.firstCall).to.have.been.calledBefore(rerunStub.firstCall);

      // Row B: markRun(2, <computed string>) before rerunDownload('dl-b')
      expect(markRunStub.secondCall.args[0]).to.equal(2);
      expect(markRunStub.secondCall.args[1]).to.be.a('string').and.not.empty;
      expect(rerunStub.secondCall.args[0]).to.equal('dl-b');
      expect(markRunStub.secondCall).to.have.been.calledBefore(rerunStub.secondCall);

      // System context — no per-user authorization
      expect(authStub).to.not.have.been.called;
    });
  });
});
