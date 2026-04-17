import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  CreateUploadArtifact,
  UpdateUploadArtifact,
  UploadArtifact,
  UploadArtifactRoleEnum
} from '../../models/upload-artifact';
import { UploadArtifactRepository } from './upload-artifact-repository';

chai.use(sinonChai);

describe('UploadArtifactRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getUploadArtifact', () => {
    it('throws an error if no record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      try {
        await repo.getUploadArtifact('upload-artifact-id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Upload artifact not found');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: UploadArtifact = {
        upload_artifact_id: 'upload-artifact-id-1',
        upload_id: 'upload-id-1',
        artifact_id: 'artifact-id-1',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_archive_id: null,
        path: null
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const result = await repo.getUploadArtifact('upload-artifact-id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getUploadArtifacts', () => {
    it('returns all records', async () => {
      const mockRows: UploadArtifact[] = [
        {
          upload_artifact_id: 'upload-artifact-id-1',
          upload_id: 'upload-id-1',
          artifact_id: 'artifact-id-1',
          role: UploadArtifactRoleEnum.FEATURE,
          upload_archive_id: null,
          path: null
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const result = await repo.getUploadArtifacts();
      expect(result).to.eql(mockRows);
    });
  });

  describe('insertUploadArtifacts', () => {
    it('throws an error if inserted row count does not match input size', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const payload: CreateUploadArtifact[] = [
        {
          upload_id: 'upload-id-1',
          artifact_id: 'artifact-id-1',
          role: UploadArtifactRoleEnum.FEATURE,
          upload_archive_id: null
        }
      ];

      try {
        await repo.insertUploadArtifacts(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert upload artifact records');
      }
    });

    it('returns inserted record ids from bulk insert', async () => {
      const mockRows = [{ upload_artifact_id: 'upload-artifact-id-1' }];
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('ON CONFLICT (upload_id, artifact_id)');
        expect(sqlStatement.text).to.include('WHERE record_end_date IS NULL');
        expect(sqlStatement.text).to.include('DO UPDATE SET');
        return Promise.resolve({ rowCount: 1, rows: mockRows, command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const payload: CreateUploadArtifact[] = [
        {
          upload_id: 'upload-id-1',
          artifact_id: 'artifact-id-1',
          role: UploadArtifactRoleEnum.FEATURE,
          upload_archive_id: null
        }
      ];

      const result = await repo.insertUploadArtifacts(payload);
      expect(result).to.eql(mockRows);
    });
  });

  describe('deleteUploadArtifactsByUploadId', () => {
    it('soft-deletes active upload artifact rows by upload_id', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 2, rows: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new UploadArtifactRepository(mockDBConnection);

      await repo.deleteUploadArtifactsByUploadId('upload-id-1');

      expect(sqlStub).to.have.been.calledOnce;
      expect(sqlStub.firstCall.args[0].text).to.include('UPDATE upload_artifact');
      expect(sqlStub.firstCall.args[0].text).to.include('record_end_date = NOW()');
      expect(sqlStub.firstCall.args[0].text).to.include('upload_id =');
      expect(sqlStub.firstCall.args[0].text).to.include('record_end_date IS NULL');
    });
  });

  describe('updateUploadArtifact', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const payload: UpdateUploadArtifact = {
        upload_id: 'upload-id-2',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_artifact_id: 'upload-artifact-id-1',
        upload_archive_id: null
      };

      try {
        await repo.updateUploadArtifact('upload-artifact-id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update upload artifact record');
      }
    });

    it('returns the updated record ID if successful', async () => {
      const mockRow = { upload_artifact_id: 'upload-artifact-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const payload: UpdateUploadArtifact = {
        upload_id: 'upload-id-2',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_artifact_id: 'upload-artifact-id-1',
        upload_archive_id: null
      };
      const result = await repo.updateUploadArtifact('upload-artifact-id-1', payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('deleteUploadArtifact', () => {
    it('throws an error if delete fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      try {
        await repo.deleteUploadArtifact('upload-artifact-id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete upload artifact record');
      }
    });

    it('succeeds if delete succeeds', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const result = await repo.deleteUploadArtifact('upload-artifact-id-1');

      expect(result).to.be.undefined;
    });
  });
});
