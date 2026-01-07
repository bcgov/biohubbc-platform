import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  ArtifactQuarantineScanFile,
  CreateArtifactQuarantineScanFile,
  SecurityStatusEnum,
  UpdateArtifactQuarantineScanFile
} from '../../models/artifact-quarantine-scan-file';
import { ArtifactQuarantineScanFileRepository } from '../../repositories/upload/artifact-quarantine-scan-file-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactQuarantineScanFileService } from './artifact-quarantine-scan-file-service';

chai.use(sinonChai);

describe('ArtifactQuarantineScanFileService', () => {
  let mockDBConnection: any;
  let service: ArtifactQuarantineScanFileService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new ArtifactQuarantineScanFileService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactQuarantineScanFile', () => {
    it('should return a single scan file record', async () => {
      const fakeScanFile: ArtifactQuarantineScanFile = {
        artifact_quarantine_scan_file_id: 'scan-file-1',
        artifact_quarantine_scan_id: 'scan-1',
        file_path: 'folder/file.txt',
        security: SecurityStatusEnum.INFECTED
      };

      const stub = sinon
        .stub(ArtifactQuarantineScanFileRepository.prototype, 'getArtifactQuarantineScanFile')
        .resolves(fakeScanFile);

      const result = await service.getArtifactQuarantineScanFile('scan-file-1');

      expect(stub).to.have.been.calledWith('scan-file-1');
      expect(result).to.eql(fakeScanFile);
    });

    it('should throw an error if repository fails', async () => {
      sinon
        .stub(ArtifactQuarantineScanFileRepository.prototype, 'getArtifactQuarantineScanFile')
        .throws(new Error('DB Error'));

      try {
        await service.getArtifactQuarantineScanFile('scan-file-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertArtifactQuarantineScanFile', () => {
    it('should insert a new scan file record and return its ID', async () => {
      const fakeInput: CreateArtifactQuarantineScanFile = {
        artifact_quarantine_scan_id: 'scan-1',
        file_path: 'folder/file.txt',
        security: SecurityStatusEnum.INFECTED
      };

      const stub = sinon
        .stub(ArtifactQuarantineScanFileRepository.prototype, 'insertArtifactQuarantineScanFile')
        .resolves({ artifact_quarantine_scan_file_id: 'scan-file-new' });

      const result = await service.insertArtifactQuarantineScanFile(fakeInput);

      expect(stub).to.have.been.calledWith(fakeInput);
      expect(result).to.eql({ artifact_quarantine_scan_file_id: 'scan-file-new' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateArtifactQuarantineScanFile = {
        artifact_quarantine_scan_id: 'scan-1',
        file_path: 'folder/file.txt',
        security: SecurityStatusEnum.INFECTED
      };

      sinon
        .stub(ArtifactQuarantineScanFileRepository.prototype, 'insertArtifactQuarantineScanFile')
        .throws(new Error('Insert failed'));

      try {
        await service.insertArtifactQuarantineScanFile(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('insertArtifactQuarantineScanFileBatch', () => {
    it('should insert multiple scan file records and return their IDs', async () => {
      const fakeInput: CreateArtifactQuarantineScanFile[] = [
        {
          artifact_quarantine_scan_id: 'scan-1',
          file_path: 'file1.txt',
          security: SecurityStatusEnum.INFECTED
        },
        {
          artifact_quarantine_scan_id: 'scan-1',
          file_path: 'file2.txt',
          security: SecurityStatusEnum.INFECTED
        }
      ];

      const stub = sinon
        .stub(ArtifactQuarantineScanFileRepository.prototype, 'insertArtifactQuarantineScanFileBatch')
        .resolves([
          { artifact_quarantine_scan_file_id: 'scan-file-1' },
          { artifact_quarantine_scan_file_id: 'scan-file-2' }
        ]);

      const result = await service.insertArtifactQuarantineScanFileBatch(fakeInput);

      expect(stub).to.have.been.calledWith(fakeInput);
      expect(result).to.eql([
        { artifact_quarantine_scan_file_id: 'scan-file-1' },
        { artifact_quarantine_scan_file_id: 'scan-file-2' }
      ]);
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateArtifactQuarantineScanFile[] = [
        {
          artifact_quarantine_scan_id: 'scan-1',
          file_path: 'file1.txt',
          security: SecurityStatusEnum.INFECTED
        }
      ];

      sinon
        .stub(ArtifactQuarantineScanFileRepository.prototype, 'insertArtifactQuarantineScanFileBatch')
        .throws(new Error('Batch insert failed'));

      try {
        await service.insertArtifactQuarantineScanFileBatch(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Batch insert failed');
      }
    });
  });

  describe('updateArtifactQuarantineScanFile', () => {
    it('should update an existing scan file record and return its ID', async () => {
      const fakeInput: UpdateArtifactQuarantineScanFile = {
        security: SecurityStatusEnum.INFECTED
      };

      const stub = sinon
        .stub(ArtifactQuarantineScanFileRepository.prototype, 'updateArtifactQuarantineScanFile')
        .resolves({ artifact_quarantine_scan_file_id: 'scan-file-1' });

      const result = await service.updateArtifactQuarantineScanFile('scan-file-1', fakeInput);

      expect(stub).to.have.been.calledWith('scan-file-1', fakeInput);
      expect(result).to.eql({ artifact_quarantine_scan_file_id: 'scan-file-1' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateArtifactQuarantineScanFile = {
        security: SecurityStatusEnum.INFECTED
      };

      sinon
        .stub(ArtifactQuarantineScanFileRepository.prototype, 'updateArtifactQuarantineScanFile')
        .throws(new Error('Update failed'));

      try {
        await service.updateArtifactQuarantineScanFile('scan-file-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });
});
