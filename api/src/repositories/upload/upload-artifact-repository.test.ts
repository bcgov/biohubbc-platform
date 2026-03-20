import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  ArtifactReferenceResolution,
  CreateUploadArtifact,
  UpdateUploadArtifact,
  UploadArtifact,
  UploadArtifactRoleEnum
} from '../../models/upload-artifact';
import { getMockDBConnection } from '../../__mocks__/db';
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

  describe('insertUploadArtifact', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const payload: CreateUploadArtifact = {
        upload_id: 'upload-id-1',
        artifact_id: 'artifact-id-1',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_archive_id: null
      };

      try {
        await repo.insertUploadArtifact(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert upload artifact record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { upload_artifact_id: 'upload-artifact-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const payload: CreateUploadArtifact = {
        upload_id: 'upload-id-1',
        artifact_id: 'artifact-id-1',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_archive_id: null
      };
      const result = await repo.insertUploadArtifact(payload);
      expect(result).to.eql(mockRow);
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

  describe('getFeatureArtifactResolutionsBySubmissionUploadIdAndReferences', () => {
    it('returns resolved artifact ids by reference using upload_artifact.path mapping', async () => {
      const mockRows: ArtifactReferenceResolution[] = [
        {
          path: '/nested/path/report.pdf',
          artifact_id: 'd4aa4d67-a289-41de-9ad2-8cf7c1cc23de'
        }
      ];
      const sqlStub = sinon
        .stub()
        .resolves({ rowCount: mockRows.length, rows: mockRows } as any as Promise<QueryResult<any>>);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const result = await repo.getFeatureArtifactResolutionsBySubmissionUploadIdAndReferences('sub-upload-1', [
        '/nested/path/report.pdf'
      ]);

      expect(result).to.eql(mockRows);
      const sqlText = (sqlStub.firstCall.args[0] as { text: string }).text;
      expect(sqlText).to.include('upload_artifact.path');
      expect(sqlText).to.include('submission_upload');
      expect(sqlText).to.include('upload_scope');
      expect(sqlText).to.not.include('artifact.checksum_sha256');
      expect(sqlText).to.not.include('regexp_replace');
    });

    it('returns empty array when no references provided', async () => {
      const sqlStub = sinon.stub();
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const result = await repo.getFeatureArtifactResolutionsBySubmissionUploadIdAndReferences('sub-upload-1', []);

      expect(result).to.eql([]);
      expect(sqlStub.called).to.be.false;
    });
  });
});
