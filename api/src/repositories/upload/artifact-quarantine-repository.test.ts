import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  ArtifactQuarantine,
  CreateArtifactQuarantine,
  UpdateArtifactQuarantine
} from '../../models/artifact-quarantine';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactQuarantineRepository } from './artifact-quarantine-repository';

chai.use(sinonChai);

describe('ArtifactQuarantineRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactQuarantine', () => {
    it('throws an error if no matching record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineRepository(mockDBConnection);

      try {
        await repo.getArtifactQuarantine('id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get quarantine record');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: ArtifactQuarantine = {
        artifact_quarantine_id: 'id-1',
        upload_artifact_id: 'artifact-uuid',
        status: 'pending'
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineRepository(mockDBConnection);

      const result = await repo.getArtifactQuarantine('id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getArtifactQuarantines', () => {
    it('returns an array of records', async () => {
      const mockRows: ArtifactQuarantine[] = [
        { artifact_quarantine_id: 'id-1', upload_artifact_id: 'a-1', status: 'pending' },
        { artifact_quarantine_id: 'id-2', upload_artifact_id: 'a-2', status: 'clean' }
      ];
      const mockQueryResponse = { rowCount: 2, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineRepository(mockDBConnection);

      const result = await repo.getArtifactQuarantines();
      expect(result).to.eql(mockRows);
    });
  });

  describe('insertArtifactQuarantine', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineRepository(mockDBConnection);

      const payload: CreateArtifactQuarantine = {
        upload_artifact_id: 'artifact-uuid',
        status: 'pending'
      };

      try {
        await repo.insertArtifactQuarantine(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert quarantine record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { quarantine_id: 'id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineRepository(mockDBConnection);

      const payload: CreateArtifactQuarantine = {
        upload_artifact_id: 'artifact-uuid',
        status: 'pending'
      };
      const result = await repo.insertArtifactQuarantine(payload);

      expect(result).to.eql(mockRow);
    });
  });

  describe('updateArtifactQuarantine', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineRepository(mockDBConnection);

      const payload: UpdateArtifactQuarantine = { status: 'clean' };

      try {
        await repo.updateArtifactQuarantine('id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update quarantine record');
      }
    });

    it('returns the updated record ID if successful', async () => {
      const mockRow = { quarantine_id: 'id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineRepository(mockDBConnection);

      const payload: UpdateArtifactQuarantine = { status: 'clean' };
      const result = await repo.updateArtifactQuarantine('id-1', payload);

      expect(result).to.eql(mockRow);
    });
  });
});
