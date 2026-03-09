import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionValidationRepository } from './submission-validation-repository';

chai.use(sinonChai);

describe('SubmissionValidationRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createSubmissionValidation', () => {
    it('should create a submission validation record and return the id', async () => {
      const mockResponse = { submission_validation_id: 1 };
      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const repository = new SubmissionValidationRepository(mockDBConnection);

      const result = await repository.createSubmissionValidation(
        '550e8400-e29b-41d4-a716-446655440000',
        1,
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(result).to.eql({ submission_validation_id: 1 });
    });

    it('should insert using submission_upload_id and submission_id columns', async () => {
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('submission_upload_id');
        expect(sqlStatement.text).to.include('submission_id');
        return Promise.resolve({
          rowCount: 1,
          rows: [{ submission_validation_id: 1 }],
          command: '',
          oid: 0,
          fields: []
        });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SubmissionValidationRepository(mockDBConnection);

      await repository.createSubmissionValidation(
        '550e8400-e29b-41d4-a716-446655440000',
        1,
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(sqlStub.calledOnce).to.be.true;
    });
  });

  describe('getSubmissionValidationBySubmissionUploadId', () => {
    it('should return the most recent validation record for a submission upload', async () => {
      const mockRecord = { submission_validation_id: 5, job_id: 'job-uuid', status: 'completed' };

      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('submission_upload_id');
        return Promise.resolve({ rowCount: 1, rows: [mockRecord], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SubmissionValidationRepository(mockDBConnection);

      const result = await repository.getSubmissionValidationBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(result).to.deep.equal(mockRecord);
      expect(sqlStub.calledOnce).to.be.true;
    });

    it('should return null when no validation record exists', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => ({ rowCount: 0, rows: [], command: '', oid: 0, fields: [] } as any)
      });

      const repository = new SubmissionValidationRepository(mockDBConnection);

      const result = await repository.getSubmissionValidationBySubmissionUploadId(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      );

      expect(result).to.be.null;
    });
  });

  describe('updateSubmissionValidationStatusBySubmissionUploadId', () => {
    it('should update the most recent validation record using submission_upload_id subquery', async () => {
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('submission_upload_id');
        return Promise.resolve({ rowCount: 1, rows: [], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SubmissionValidationRepository(mockDBConnection);

      await repository.updateSubmissionValidationStatusBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000',
        'failed',
        { error: 'timeout' }
      );

      expect(sqlStub.calledOnce).to.be.true;
    });
  });

  describe('updateSubmissionValidationStatus', () => {
    it('should update status to started', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const repository = new SubmissionValidationRepository(mockDBConnection);

      const result = await repository.updateSubmissionValidationStatus(
        '123e4567-e89b-12d3-a456-426614174000',
        'started'
      );

      expect(result).to.be.undefined;
    });

    it('should update status to completed with metadata', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const repository = new SubmissionValidationRepository(mockDBConnection);

      const result = await repository.updateSubmissionValidationStatus(
        '123e4567-e89b-12d3-a456-426614174000',
        'completed',
        { processed_count: 10 }
      );

      expect(result).to.be.undefined;
    });

    it('should update status to failed with error metadata', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const repository = new SubmissionValidationRepository(mockDBConnection);

      const result = await repository.updateSubmissionValidationStatus(
        '123e4567-e89b-12d3-a456-426614174000',
        'failed',
        { error: 'Something went wrong' }
      );

      expect(result).to.be.undefined;
    });
  });
});
