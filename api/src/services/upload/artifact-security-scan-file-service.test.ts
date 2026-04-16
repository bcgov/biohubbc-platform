import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { IDBConnection } from '../../database/db';
import {
  ArtifactSecurityScanFile,
  CreateArtifactSecurityScanFile,
  UpdateArtifactSecurityScanFile
} from '../../models/artifact-security-scan-file';
import { SecurityStatusEnum } from '../../models/security-status';
import { ArtifactSecurityScanFileRepository } from '../../repositories/upload/artifact-security-scan-file-repository';
import { ArtifactSecurityScanFileService } from './artifact-security-scan-file-service';

chai.use(sinonChai);

describe('ArtifactSecurityScanFileService', () => {
  let mockDBConnection: IDBConnection;
  let service: ArtifactSecurityScanFileService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new ArtifactSecurityScanFileService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurityScanFile', () => {
    it('should return a single scan file record', async () => {
      const fakeScanFile: ArtifactSecurityScanFile = {
        artifact_security_scan_file_id: 'scan-file-1',
        artifact_security_scan_id: 'scan-1',
        file_path: 'folder/file.txt',
        result: SecurityStatusEnum.INFECTED
      };

      sinon.stub(ArtifactSecurityScanFileRepository.prototype, 'getArtifactSecurityScanFile').resolves(fakeScanFile);

      const result = await service.getArtifactSecurityScanFile('scan-file-1');

      expect(result).to.eql(fakeScanFile);
    });

    it('should throw an error if repository fails', async () => {
      sinon
        .stub(ArtifactSecurityScanFileRepository.prototype, 'getArtifactSecurityScanFile')
        .rejects(new Error('DB Error'));

      try {
        await service.getArtifactSecurityScanFile('scan-file-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertArtifactSecurityScanFile', () => {
    it('should insert a new scan file record and return the record', async () => {
      const fakeInput: CreateArtifactSecurityScanFile = {
        artifact_security_scan_id: 'scan-1',
        file_path: 'folder/file.txt',
        result: SecurityStatusEnum.INFECTED
      };

      const fakeOutput: ArtifactSecurityScanFile = {
        artifact_security_scan_file_id: 'scan-file-new',
        artifact_security_scan_id: 'artifact-security-scan-1',
        file_path: 'file/path',
        result: SecurityStatusEnum.CLEAN
      };

      sinon.stub(ArtifactSecurityScanFileRepository.prototype, 'insertArtifactSecurityScanFile').resolves(fakeOutput);

      const result = await service.insertArtifactSecurityScanFile(fakeInput);

      expect(result).to.eql(fakeOutput);
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateArtifactSecurityScanFile = {
        artifact_security_scan_id: 'scan-1',
        file_path: 'folder/file.txt',
        result: SecurityStatusEnum.INFECTED
      };

      sinon
        .stub(ArtifactSecurityScanFileRepository.prototype, 'insertArtifactSecurityScanFile')
        .rejects(new Error('Insert failed'));

      try {
        await service.insertArtifactSecurityScanFile(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('insertArtifactSecurityScanFileBatch', () => {
    it('should insert multiple scan file records and return their IDs', async () => {
      const fakeInput: CreateArtifactSecurityScanFile[] = [
        {
          artifact_security_scan_id: 'scan-1',
          file_path: 'file1.txt',
          result: SecurityStatusEnum.INFECTED
        },
        {
          artifact_security_scan_id: 'scan-1',
          file_path: 'file2.txt',
          result: SecurityStatusEnum.INFECTED
        }
      ];

      const fakeOutput: ArtifactSecurityScanFile[] = [
        {
          artifact_security_scan_file_id: 'scan-file-1',
          artifact_security_scan_id: 'artifact-security-scan-1',
          file_path: 'file/path1',
          result: SecurityStatusEnum.CLEAN
        },
        {
          artifact_security_scan_file_id: 'scan-file-2',
          artifact_security_scan_id: 'artifact-security-scan-1',
          file_path: 'file/path2',
          result: SecurityStatusEnum.CLEAN
        }
      ];

      sinon
        .stub(ArtifactSecurityScanFileRepository.prototype, 'insertArtifactSecurityScanFileBatch')
        .resolves(fakeOutput);

      const result = await service.insertArtifactSecurityScanFileBatch(fakeInput);

      expect(result).to.eql(fakeOutput);
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateArtifactSecurityScanFile[] = [
        {
          artifact_security_scan_id: 'scan-1',
          file_path: 'file1.txt',
          result: SecurityStatusEnum.INFECTED
        }
      ];

      sinon
        .stub(ArtifactSecurityScanFileRepository.prototype, 'insertArtifactSecurityScanFileBatch')
        .rejects(new Error('Batch insert failed'));

      try {
        await service.insertArtifactSecurityScanFileBatch(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Batch insert failed');
      }
    });
  });

  describe('updateArtifactSecurityScanFile', () => {
    it('should update an existing scan file record and return the record', async () => {
      const fakeInput: UpdateArtifactSecurityScanFile = {
        result: SecurityStatusEnum.INFECTED
      };

      const fakeOutput: ArtifactSecurityScanFile = {
        artifact_security_scan_file_id: 'scan-file-1',
        artifact_security_scan_id: 'artifact-security-scan-1',
        file_path: 'file/path',
        result: SecurityStatusEnum.CLEAN
      };

      sinon.stub(ArtifactSecurityScanFileRepository.prototype, 'updateArtifactSecurityScanFile').resolves(fakeOutput);

      const result = await service.updateArtifactSecurityScanFile('scan-file-1', fakeInput);

      expect(result).to.eql(fakeOutput);
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateArtifactSecurityScanFile = {
        result: SecurityStatusEnum.INFECTED
      };

      sinon
        .stub(ArtifactSecurityScanFileRepository.prototype, 'updateArtifactSecurityScanFile')
        .rejects(new Error('Update failed'));

      try {
        await service.updateArtifactSecurityScanFile('scan-file-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });
});
