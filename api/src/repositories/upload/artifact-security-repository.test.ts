import chai, { expect } from 'chai';
import dayjs from 'dayjs';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { SecurityStatusEnum } from '../../models/security-status';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactSecurityRepository } from './artifact-security-repository';

chai.use(sinonChai);

describe('ArtifactSecurityRepository', () => {
  const mockSecurityRecord: ArtifactSecurity = {
    artifact_security_id: '11111111-1111-1111-1111-111111111111',
    artifact_id: '22222222-2222-2222-2222-222222222222',
    security: SecurityStatusEnum.CLEAN
  };

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurity', () => {
    it('throws an error if no matching record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      try {
        await repo.getArtifactSecurity(mockSecurityRecord.artifact_security_id);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Failed to get security record');
      }
    });

    it('returns a record if found', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [mockSecurityRecord] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.getArtifactSecurity(mockSecurityRecord.artifact_security_id);
      expect(result).to.eql(mockSecurityRecord);
    });
  });

  describe('getArtifactSecuritys', () => {
    it('returns all records', async () => {
      const mockRows: ArtifactSecurity[] = [
        mockSecurityRecord,
        {
          artifact_security_id: '33333333-3333-3333-3333-333333333333',
          artifact_id: '44444444-4444-4444-4444-444444444444',
          security: SecurityStatusEnum.INFECTED
        }
      ];
      const mockQueryResponse = { rowCount: mockRows.length, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.getArtifactSecuritys();
      expect(result).to.eql(mockRows);
    });

    it('returns empty array if no records found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.getArtifactSecuritys();
      expect(result).to.eql([]);
    });
  });

  describe('insertArtifactSecurity', () => {
    const payload: CreateArtifactSecurity = {
      artifact_id: '22222222-2222-2222-2222-222222222222',
      security: SecurityStatusEnum.CLEAN
    };

    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      try {
        await repo.insertArtifactSecurity(payload);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Failed to insert security record');
      }
    });

    it('returns inserted record if successful', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [mockSecurityRecord] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.insertArtifactSecurity(payload);
      expect(result).to.eql(mockSecurityRecord);
    });
  });

  describe('insertArtifactSecurityByUploadId', () => {
    const uploadId = 'upload-456';
    const payload = {
      security: SecurityStatusEnum.PENDING
    };

    const mockSecurityRecords: ArtifactSecurity[] = [
      {
        artifact_security_id: '11111111-1111-1111-1111-111111111111',
        artifact_id: '22222222-2222-2222-2222-222222222222',
        security: SecurityStatusEnum.PENDING
      },
      {
        artifact_security_id: '33333333-3333-3333-3333-333333333333',
        artifact_id: '44444444-4444-4444-4444-444444444444',
        security: SecurityStatusEnum.PENDING
      }
    ];

    it('throws an error if no records inserted', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      try {
        await repo.insertArtifactSecurityByUploadId(uploadId, payload);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Failed to insert security records');
      }
    });

    it('returns inserted records if successful', async () => {
      const mockQueryResponse = { rowCount: mockSecurityRecords.length, rows: mockSecurityRecords } as any as Promise<
        QueryResult<any>
      >;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.insertArtifactSecurityByUploadId(uploadId, payload);
      expect(result).to.eql(mockSecurityRecords);
    });

    it('returns single record if only one artifact in upload', async () => {
      const mockSingleRecord: ArtifactSecurity[] = [mockSecurityRecords[0]];
      const mockQueryResponse = { rowCount: 1, rows: mockSingleRecord } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.insertArtifactSecurityByUploadId(uploadId, payload);
      expect(result).to.eql(mockSingleRecord);
      expect(result).to.have.lengthOf(1);
    });
  });

  describe('updateArtifactSecurity', () => {
    const payload: UpdateArtifactSecurity = {
      security: SecurityStatusEnum.INFECTED
    };

    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      try {
        await repo.updateArtifactSecurity(mockSecurityRecord.artifact_security_id, payload);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Failed to update security record');
      }
    });

    it('returns updated record if successful', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [mockSecurityRecord] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.updateArtifactSecurity(mockSecurityRecord.artifact_security_id, payload);
      expect(result).to.eql(mockSecurityRecord);
    });

    it('allows updating record_end_date', async () => {
      const now = dayjs().toISOString();
      const updatedRecord: ArtifactSecurity = { ...mockSecurityRecord };
      const mockQueryResponse = { rowCount: 1, rows: [updatedRecord] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.updateArtifactSecurity(mockSecurityRecord.artifact_security_id, {
        record_end_date: now
      });
      expect(result).to.eql(updatedRecord);
    });

    it('allows updating artifact_id', async () => {
      const newArtifactId = '99999999-9999-9999-9999-999999999999';
      const updatedRecord: ArtifactSecurity = { ...mockSecurityRecord, artifact_id: newArtifactId };
      const mockQueryResponse = { rowCount: 1, rows: [updatedRecord] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.updateArtifactSecurity(mockSecurityRecord.artifact_security_id, {
        artifact_id: newArtifactId
      });
      expect(result).to.eql(updatedRecord);
    });
  });
});
