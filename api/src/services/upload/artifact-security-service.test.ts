import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDBConnection } from '../../database/db';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { SecurityStatusEnum } from '../../models/security-status';
import { ArtifactSecurityRepository } from '../../repositories/upload/artifact-security-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactSecurityService } from './artifact-security-service';

chai.use(sinonChai);

describe('ArtifactSecurityService', () => {
  let mockDBConnection: IDBConnection;
  let service: ArtifactSecurityService;

  const mockSecurityRecord: ArtifactSecurity = {
    artifact_security_id: 'uuid-1',
    artifact_id: 'artifact-1',
    security: SecurityStatusEnum.CLEAN
  };

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new ArtifactSecurityService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurity', () => {
    it('should return a single security record', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);

      const result = await service.getArtifactSecurity('uuid-1');

      expect(result).to.eql(mockSecurityRecord);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').rejects(new Error('DB Error'));

      try {
        await service.getArtifactSecurity('uuid-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertArtifactSecurity', () => {
    const fakeInput: CreateArtifactSecurity = {
      artifact_id: 'artifact-1',
      security: SecurityStatusEnum.CLEAN
    };

    it('should insert a new security record and return it', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurity').resolves(mockSecurityRecord);

      const result = await service.insertArtifactSecurity(fakeInput);

      expect(result).to.eql(mockSecurityRecord);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurity').rejects(new Error('Insert failed'));

      try {
        await service.insertArtifactSecurity(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('insertArtifactSecurityByUploadId', () => {
    const uploadId = 'upload-456';
    const fakeInput = {
      security: SecurityStatusEnum.PENDING
    };

    const mockSecurityRecords: ArtifactSecurity[] = [
      {
        artifact_security_id: 'uuid-1',
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.PENDING
      },
      {
        artifact_security_id: 'uuid-2',
        artifact_id: 'artifact-2',
        security: SecurityStatusEnum.PENDING
      }
    ];

    it('should insert security records for all artifacts in upload and return them', async () => {
      sinon
        .stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurityByUploadId')
        .resolves(mockSecurityRecords);

      const result = await service.insertArtifactSecurityByUploadId(uploadId, fakeInput);

      expect(result).to.eql(mockSecurityRecords);
      expect(result).to.have.lengthOf(2);
    });

    it('should return single record if only one artifact in upload', async () => {
      const singleRecord = [mockSecurityRecords[0]];
      sinon.stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurityByUploadId').resolves(singleRecord);

      const result = await service.insertArtifactSecurityByUploadId(uploadId, fakeInput);

      expect(result).to.eql(singleRecord);
      expect(result).to.have.lengthOf(1);
    });

    it('should throw an error if repository fails', async () => {
      sinon
        .stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurityByUploadId')
        .rejects(new Error('Batch insert failed'));

      try {
        await service.insertArtifactSecurityByUploadId(uploadId, fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Batch insert failed');
      }
    });
  });

  describe('updateArtifactSecurity', () => {
    const fakeUpdate: UpdateArtifactSecurity = {
      security: SecurityStatusEnum.INFECTED
    };

    it('should update an existing security record and return it', async () => {
      const updatedRecord: ArtifactSecurity = {
        ...mockSecurityRecord,
        security: SecurityStatusEnum.INFECTED
      };
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').resolves(updatedRecord);

      const result = await service.updateArtifactSecurity('uuid-1', fakeUpdate);

      expect(result).to.eql(updatedRecord);
      expect(result.security).to.equal(SecurityStatusEnum.INFECTED);
    });

    it('should allow updating to the same security value', async () => {
      const sameValueUpdate: UpdateArtifactSecurity = {
        security: SecurityStatusEnum.CLEAN
      };
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').resolves(mockSecurityRecord);

      const result = await service.updateArtifactSecurity('uuid-1', sameValueUpdate);

      expect(result).to.eql(mockSecurityRecord);
    });

    it('should allow updating record_end_date', async () => {
      const endDate = '2025-12-31T23:59:59Z';
      const updateWithEndDate: UpdateArtifactSecurity = {
        record_end_date: endDate
      };
      const recordWithEndDate: ArtifactSecurity = {
        ...mockSecurityRecord,
        artifact_security_id: 'uuid-1'
      };
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').resolves(recordWithEndDate);

      const result = await service.updateArtifactSecurity('uuid-1', updateWithEndDate);

      expect(result).to.eql(recordWithEndDate);
    });

    it('should allow updating artifact_id', async () => {
      const newArtifactId = 'artifact-new';
      const updateWithNewArtifact: UpdateArtifactSecurity = {
        artifact_id: newArtifactId
      };
      const recordWithNewArtifact: ArtifactSecurity = {
        ...mockSecurityRecord,
        artifact_id: newArtifactId
      };
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').resolves(recordWithNewArtifact);

      const result = await service.updateArtifactSecurity('uuid-1', updateWithNewArtifact);

      expect(result).to.eql(recordWithNewArtifact);
      expect(result.artifact_id).to.equal(newArtifactId);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').rejects(new Error('Update failed'));

      try {
        await service.updateArtifactSecurity('uuid-1', fakeUpdate);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });
});
