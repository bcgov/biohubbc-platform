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

      const result = await repository.createSubmissionValidation(1, '123e4567-e89b-12d3-a456-426614174000');

      expect(result).to.eql({ submission_validation_id: 1 });
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
