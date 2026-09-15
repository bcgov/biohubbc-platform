import { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  SubmissionUploadProcessingStatus,
  SubmissionUploadProcessingStatusHistoryRow
} from '../../models/submission-upload-processing-status';
import { SubmissionUploadProcessingStatusRepository } from './submission-upload-processing-status-repository';

const SUBMISSION_UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';
const SUBMISSION_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('SubmissionUploadProcessingStatusRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionUploadProcessingStatus', () => {
    it('returns the inserted row', async () => {
      const row = buildRow({ status: 'ingesting' });
      const sqlStub = sinon
        .stub()
        .resolves({ rowCount: 1, rows: [row] } as QueryResult<SubmissionUploadProcessingStatus>);
      const repository = new SubmissionUploadProcessingStatusRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.insertSubmissionUploadProcessingStatus(SUBMISSION_UPLOAD_ID, 'ingesting');

      expect(result).to.eql(row);
      expect(sqlStub.firstCall.args[0].values).to.eql([SUBMISSION_UPLOAD_ID, 'ingesting']);
    });

    it('throws ApiExecuteSQLError when the insert does not return one row', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<any>);
      const repository = new SubmissionUploadProcessingStatusRepository(getMockDBConnection({ sql: sqlStub }));

      try {
        await repository.insertSubmissionUploadProcessingStatus(SUBMISSION_UPLOAD_ID, 'ingesting');
        expect.fail('Expected ApiExecuteSQLError not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('endActiveSubmissionUploadProcessingStatuses', () => {
    it('end-dates only active rows in the given statuses and returns how many were ended', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 2, rows: [] });
      const repository = new SubmissionUploadProcessingStatusRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.endActiveSubmissionUploadProcessingStatuses(SUBMISSION_UPLOAD_ID, [
        'indexing',
        'indexed'
      ]);

      expect(result).to.equal(2);
      expect(sqlStub.firstCall.args[0].text).to.contain('SET\n        record_end_date = now()');
      expect(sqlStub.firstCall.args[0].text).to.contain('record_end_date IS NULL');
      expect(sqlStub.firstCall.args[0].values).to.eql([SUBMISSION_UPLOAD_ID, ['indexing', 'indexed']]);
    });

    it('returns zero when nothing was active', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] });
      const repository = new SubmissionUploadProcessingStatusRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.endActiveSubmissionUploadProcessingStatuses(SUBMISSION_UPLOAD_ID, ['failed']);

      expect(result).to.equal(0);
    });
  });

  describe('findSubmissionUploadProcessingStatusHistory', () => {
    it('joins the upload to its active processing rows in one query, ordered by create_date then id', async () => {
      const rows: SubmissionUploadProcessingStatusHistoryRow[] = [
        buildHistoryRow({ submission_upload_status_id: 1, status: 'uploaded' }),
        buildHistoryRow({ submission_upload_status_id: 2, status: 'ingesting' })
      ];
      const sqlStub = sinon
        .stub()
        .resolves({ rowCount: 2, rows } as QueryResult<SubmissionUploadProcessingStatusHistoryRow>);
      const repository = new SubmissionUploadProcessingStatusRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.findSubmissionUploadProcessingStatusHistory(
        SUBMISSION_UUID,
        SUBMISSION_UPLOAD_ID
      );

      expect(result).to.eql(rows);
      expect(sqlStub).to.have.been.calledOnce;
      const statement = sqlStub.firstCall.args[0];
      expect(statement.text).to.contain('LEFT JOIN submission_upload_status sus');
      expect(statement.text).to.contain('sus.record_end_date IS NULL');
      expect(statement.text).to.contain('su.record_end_date IS NULL');
      expect(statement.text).to.contain(
        'ORDER BY\n        sus.create_date ASC,\n        sus.submission_upload_status_id ASC'
      );
      expect(statement.values).to.eql([SUBMISSION_UUID, SUBMISSION_UPLOAD_ID]);
    });

    it('returns the rows as delivered, including the null row for an upload with no history', async () => {
      const rows: SubmissionUploadProcessingStatusHistoryRow[] = [
        {
          submission_upload_id: SUBMISSION_UPLOAD_ID,
          submission_upload_status_id: null,
          status: null,
          create_date: null
        }
      ];
      const sqlStub = sinon
        .stub()
        .resolves({ rowCount: 1, rows } as QueryResult<SubmissionUploadProcessingStatusHistoryRow>);
      const repository = new SubmissionUploadProcessingStatusRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.findSubmissionUploadProcessingStatusHistory(
        SUBMISSION_UUID,
        SUBMISSION_UPLOAD_ID
      );

      expect(result).to.eql(rows);
    });
  });
});

const buildHistoryRow = (params: {
  submission_upload_status_id: number;
  status: SubmissionUploadProcessingStatus['status'];
}): SubmissionUploadProcessingStatusHistoryRow => ({
  submission_upload_id: SUBMISSION_UPLOAD_ID,
  submission_upload_status_id: params.submission_upload_status_id,
  status: params.status,
  create_date: '2026-09-03T00:00:00.000Z'
});

const buildRow = (params: {
  submission_upload_status_id?: number;
  status: SubmissionUploadProcessingStatus['status'];
}): SubmissionUploadProcessingStatus => ({
  submission_upload_status_id: params.submission_upload_status_id ?? 2,
  submission_upload_id: SUBMISSION_UPLOAD_ID,
  status: params.status,
  record_end_date: null,
  create_date: '2026-09-03T00:00:00.000Z'
});
