import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiGeneralError } from '../errors/api-error';
import { IInsertSubmissionRecord, SubmissionRepository } from './submission-repository';
import { QueryResult } from 'pg';

chai.use(sinonChai);

describe('SubmissionRepository', () => {
  describe('insertSubmissionRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    const mockParams = {
      source: 'test',
      input_file_name: 'test',
      input_key: 'test',
      event_timestamp: 'test',
      eml_source: 'test',
      darwin_core_source: 'test',
      uuid: 'test'
    };

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionRecord((mockParams as unknown) as IInsertSubmissionRecord);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = ({ rowCount: 1, rows: [{ submission_id: 1 }] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionRecord(
        (mockParams as unknown) as IInsertSubmissionRecord
      );

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('updateSubmissionRecordInputKey', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.updateSubmissionRecordInputKey(1, 'test');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = ({ rowCount: 1, rows: [{ submission_id: 1 }] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionRecordInputKey(1, 'test');

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('getSubmissionRecordBySubmissionId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionRecordBySubmissionId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResonse = {
        source: 'test',
        input_file_name: 'test',
        input_key: 'test',
        event_timestamp: 'test',
        eml_source: 'test',
        darwin_core_source: 'test',
        uuid: 'test'
      };
      const mockQueryResponse = ({ rowCount: 1, rows: [mockResonse] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionRecordBySubmissionId(1);

      expect(response).to.eql(mockResonse);
    });
  });
});
