import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  ArtifactQuarantineScan,
  CreateArtifactQuarantineScan,
  UpdateArtifactQuarantineScan
} from '../../models/artifact-quarantine-scan';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { ArtifactQuarantineScanRepository } from '../../repositories/upload/artifact-quarantine-scan-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactQuarantineScanService } from './artifact-quarantine-scan-service';

chai.use(sinonChai);

describe('ArtifactQuarantineScanService', () => {
  let mockDBConnection: any;
  let service: ArtifactQuarantineScanService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new ArtifactQuarantineScanService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactQuarantineScan', () => {
    it('should return a single scan record', async () => {
      const fakeScan: ArtifactQuarantineScan = {
        artifact_quarantine_scan_id: 'scan-1',
        artifact_quarantine_id: 'quarantine-1',
        status: ProcessStatusStatusEnum.PENDING,
        scanner_version: 'v1',
        scanned_at: '2025-01-01T00:00:00Z',
        results: {}
      };

      const stub = sinon
        .stub(ArtifactQuarantineScanRepository.prototype, 'getArtifactQuarantineScan')
        .resolves(fakeScan);

      const result = await service.getArtifactQuarantineScan('scan-1');

      expect(stub).to.have.been.calledWith('scan-1');
      expect(result).to.eql(fakeScan);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactQuarantineScanRepository.prototype, 'getArtifactQuarantineScan').throws(new Error('DB Error'));

      try {
        await service.getArtifactQuarantineScan('scan-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('getArtifactQuarantineScans', () => {
    it('should return all scan records', async () => {
      const fakeScans: ArtifactQuarantineScan[] = [
        {
          artifact_quarantine_scan_id: 'scan-1',
          artifact_quarantine_id: 'quarantine-1',
          status: ProcessStatusStatusEnum.PENDING,
          scanner_version: 'v1',
          scanned_at: '2025-01-01T00:00:00Z',
          results: {}
        },
        {
          artifact_quarantine_scan_id: 'scan-2',
          artifact_quarantine_id: 'quarantine-2',
          status: ProcessStatusStatusEnum.COMPLETED,
          scanner_version: 'v2',
          scanned_at: '2025-01-02T00:00:00Z',
          results: { reason: 'malware detected' }
        }
      ];

      const stub = sinon
        .stub(ArtifactQuarantineScanRepository.prototype, 'getArtifactQuarantineScans')
        .resolves(fakeScans);

      const result = await service.getArtifactQuarantineScans();

      expect(stub).to.have.been.calledWith();
      expect(result).to.eql(fakeScans);
    });

    it('should throw an error if repository fails', async () => {
      sinon
        .stub(ArtifactQuarantineScanRepository.prototype, 'getArtifactQuarantineScans')
        .throws(new Error('DB Error'));

      try {
        await service.getArtifactQuarantineScans();
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertArtifactQuarantineScan', () => {
    it('should insert a new scan record and return its ID', async () => {
      const fakeInput: CreateArtifactQuarantineScan = {
        artifact_quarantine_id: 'quarantine-1',
        status: ProcessStatusStatusEnum.PENDING,
        scanner_version: 'v1',
        scanned_at: '2025-01-01T00:00:00Z',
        results: {}
      };

      const stub = sinon
        .stub(ArtifactQuarantineScanRepository.prototype, 'insertArtifactQuarantineScan')
        .resolves({ artifact_quarantine_scan_id: 'scan-new' });

      const result = await service.insertArtifactQuarantineScan(fakeInput);

      expect(stub).to.have.been.calledWith(fakeInput);
      expect(result).to.eql({ artifact_quarantine_scan_id: 'scan-new' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateArtifactQuarantineScan = {
        artifact_quarantine_id: 'quarantine-1',
        status: ProcessStatusStatusEnum.PENDING,
        scanner_version: 'v1',
        scanned_at: '2025-01-01T00:00:00Z',
        results: {}
      };

      sinon
        .stub(ArtifactQuarantineScanRepository.prototype, 'insertArtifactQuarantineScan')
        .throws(new Error('Insert failed'));

      try {
        await service.insertArtifactQuarantineScan(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('updateArtifactQuarantineScan', () => {
    it('should update an existing scan record and return its ID', async () => {
      const fakeInput: UpdateArtifactQuarantineScan = {
        status: ProcessStatusStatusEnum.COMPLETED,
        scanner_version: 'v2',
        scanned_at: '2025-02-01T00:00:00Z',
        results: { reason: 'malware detected' }
      };

      const stub = sinon
        .stub(ArtifactQuarantineScanRepository.prototype, 'updateArtifactQuarantineScan')
        .resolves({ artifact_quarantine_scan_id: 'scan-1' });

      const result = await service.updateArtifactQuarantineScan('scan-1', fakeInput);

      expect(stub).to.have.been.calledWith('scan-1', fakeInput);
      expect(result).to.eql({ artifact_quarantine_scan_id: 'scan-1' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateArtifactQuarantineScan = {
        status: ProcessStatusStatusEnum.COMPLETED,
        scanner_version: 'v2',
        scanned_at: '2025-02-01T00:00:00Z',
        results: { reason: 'malware detected' }
      };

      sinon
        .stub(ArtifactQuarantineScanRepository.prototype, 'updateArtifactQuarantineScan')
        .throws(new Error('Update failed'));

      try {
        await service.updateArtifactQuarantineScan('scan-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });
});
