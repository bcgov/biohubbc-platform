import chai, { expect } from 'chai';
import dayjs from 'dayjs';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { SecurityStatusEnum } from '../../models/security-status';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactSecurityRepository } from './artifact-security-repository';

chai.use(sinonChai);

describe('ArtifactSecurityRepository', () => {
  let mockDBConnection: any;
  let repo: ArtifactSecurityRepository;

  const mockSecurityRecord: ArtifactSecurity = {
    artifact_security_id: '11111111-1111-1111-1111-111111111111',
    artifact_id: '22222222-2222-2222-2222-222222222222',
    security: SecurityStatusEnum.CLEAN
  };

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    repo = new ArtifactSecurityRepository(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurity', () => {
    it('throws an error if no matching record found', async () => {
      sinon.stub(mockDBConnection, 'sql').resolves({ rowCount: 0, rows: [] });

      try {
        await repo.getArtifactSecurity(mockSecurityRecord.artifact_security_id);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Failed to get security record');
      }
    });

    it('returns a record if found', async () => {
      sinon.stub(mockDBConnection, 'sql').resolves({ rowCount: 1, rows: [mockSecurityRecord] });

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
      sinon.stub(mockDBConnection, 'sql').resolves({ rowCount: mockRows.length, rows: mockRows });

      const result = await repo.getArtifactSecuritys();
      expect(result).to.eql(mockRows);
    });
  });

  describe('insertArtifactSecurity', () => {
    const payload: CreateArtifactSecurity = {
      artifact_id: '22222222-2222-2222-2222-222222222222',
      security: SecurityStatusEnum.CLEAN
    };

    it('throws an error if insert fails', async () => {
      sinon.stub(mockDBConnection, 'sql').resolves({ rowCount: 0, rows: [] });

      try {
        await repo.insertArtifactSecurity(payload);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Failed to insert security record');
      }
    });

    it('returns inserted record if successful', async () => {
      sinon.stub(mockDBConnection, 'sql').resolves({ rowCount: 1, rows: [mockSecurityRecord] });

      const result = await repo.insertArtifactSecurity(payload);
      expect(result).to.eql(mockSecurityRecord);
    });
  });

  describe('updateArtifactSecurity', () => {
    const payload: UpdateArtifactSecurity = {
      security: SecurityStatusEnum.INFECTED
    };

    it('throws an error if update fails', async () => {
      sinon.stub(mockDBConnection, 'sql').resolves({ rowCount: 0, rows: [] });

      try {
        await repo.updateArtifactSecurity(mockSecurityRecord.artifact_security_id, payload);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Failed to update security record');
      }
    });

    it('returns updated record if successful', async () => {
      sinon.stub(mockDBConnection, 'sql').resolves({ rowCount: 1, rows: [mockSecurityRecord] });

      const result = await repo.updateArtifactSecurity(mockSecurityRecord.artifact_security_id, payload);
      expect(result).to.eql(mockSecurityRecord);
    });

    it('allows updating record_end_date', async () => {
      const now = dayjs().toISOString();
      const updatedRecord: ArtifactSecurity = { ...mockSecurityRecord };
      sinon.stub(mockDBConnection, 'sql').resolves({ rowCount: 1, rows: [updatedRecord] });

      const result = await repo.updateArtifactSecurity(mockSecurityRecord.artifact_security_id, {
        record_end_date: now
      });
      expect(result).to.eql(updatedRecord);
    });
  });
});
