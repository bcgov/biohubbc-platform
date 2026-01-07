import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { SecurityStatusEnum } from '../../models/artifact-security-scan-file';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactSecurityRepository } from './artifact-security-repository';

chai.use(sinonChai);

describe('ArtifactSecurityRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurity', () => {
    it('throws an error if no matching record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      try {
        await repo.getArtifactSecurity('id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get security record');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: ArtifactSecurity = {
        artifact_security_id: 'id-1',
        artifact_id: 'artifact-uuid',
        security: SecurityStatusEnum.CLEAN
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.getArtifactSecurity('id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getArtifactSecuritys', () => {
    it('returns an array of records', async () => {
      const mockRows: ArtifactSecurity[] = [
        { artifact_security_id: 'id-1', artifact_id: 'a-1', security: SecurityStatusEnum.CLEAN },
        { artifact_security_id: 'id-2', artifact_id: 'a-2', security: SecurityStatusEnum.INFECTED }
      ];
      const mockQueryResponse = { rowCount: 2, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const result = await repo.getArtifactSecuritys();
      expect(result).to.eql(mockRows);
    });
  });

  describe('insertArtifactSecurity', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const payload: CreateArtifactSecurity = {
        artifact_id: 'artifact-uuid',
        security: SecurityStatusEnum.CLEAN
      };

      try {
        await repo.insertArtifactSecurity(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert security record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { security_id: 'id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const payload: CreateArtifactSecurity = {
        artifact_id: 'artifact-uuid',
        security: SecurityStatusEnum.CLEAN
      };
      const result = await repo.insertArtifactSecurity(payload);

      expect(result).to.eql(mockRow);
    });
  });

  describe('updateArtifactSecurity', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const payload: UpdateArtifactSecurity = { security: SecurityStatusEnum.INFECTED };

      try {
        await repo.updateArtifactSecurity('id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update security record');
      }
    });

    it('returns the updated record ID if successful', async () => {
      const mockRow = { security_id: 'id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityRepository(mockDBConnection);

      const payload: UpdateArtifactSecurity = { security: SecurityStatusEnum.INFECTED };
      const result = await repo.updateArtifactSecurity('id-1', payload);

      expect(result).to.eql(mockRow);
    });
  });
});
