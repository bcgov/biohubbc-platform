import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDBConnection } from '../../database/db';
import {
  ArtifactSecurityScan,
  CreateArtifactSecurityScan,
  UpdateArtifactSecurityScan
} from '../../models/artifact-security-scan';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { ArtifactSecurityScanRepository } from '../../repositories/upload/artifact-security-scan-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactSecurityScanService } from './artifact-security-scan-service';

chai.use(sinonChai);

describe('ArtifactSecurityScanService', () => {
  let mockDBConnection: IDBConnection;
  let service: ArtifactSecurityScanService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new ArtifactSecurityScanService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurityScan', () => {
    it('should return a single scan record', async () => {
      const fakeScan: ArtifactSecurityScan = {
        artifact_security_scan_id: 'scan-1',
        artifact_security_id: 'security-1',
        scan_status: ProcessStatusStatusEnum.PENDING,
        scanner_version: 'v1',
        scanned_at: '2025-01-01T00:00:00Z',
        results: {}
      };

      const stub = sinon.stub(ArtifactSecurityScanRepository.prototype, 'getArtifactSecurityScan').resolves(fakeScan);

      const result = await service.getArtifactSecurityScan('scan-1');

      expect(stub).to.have.been.calledWith('scan-1');
      expect(result).to.eql(fakeScan);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityScanRepository.prototype, 'getArtifactSecurityScan').throws(new Error('DB Error'));

      try {
        await service.getArtifactSecurityScan('scan-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('getArtifactSecurityScans', () => {
    it('should return all scan records', async () => {
      const fakeScans: ArtifactSecurityScan[] = [
        {
          artifact_security_scan_id: 'scan-1',
          artifact_security_id: 'security-1',
          scan_status: ProcessStatusStatusEnum.PENDING,
          scanner_version: 'v1',
          scanned_at: '2025-01-01T00:00:00Z',
          results: {}
        },
        {
          artifact_security_scan_id: 'scan-2',
          artifact_security_id: 'security-2',
          scan_status: ProcessStatusStatusEnum.COMPLETED,
          scanner_version: 'v2',
          scanned_at: '2025-01-02T00:00:00Z',
          results: { reason: 'malware detected' }
        }
      ];

      const stub = sinon.stub(ArtifactSecurityScanRepository.prototype, 'getArtifactSecurityScans').resolves(fakeScans);

      const result = await service.getArtifactSecurityScans();

      expect(stub).to.have.been.calledWith();
      expect(result).to.eql(fakeScans);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityScanRepository.prototype, 'getArtifactSecurityScans').throws(new Error('DB Error'));

      try {
        await service.getArtifactSecurityScans();
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertArtifactSecurityScan', () => {
    it('should insert a new scan record and return its ID', async () => {
      const fakeInput: CreateArtifactSecurityScan = {
        artifact_security_id: 'security-1',
        scan_status: ProcessStatusStatusEnum.PENDING,
        scanner_version: 'v1',
        scanned_at: '2025-01-01T00:00:00Z',
        results: {}
      };

      const stub = sinon
        .stub(ArtifactSecurityScanRepository.prototype, 'insertArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-new' });

      const result = await service.insertArtifactSecurityScan(fakeInput);

      expect(stub).to.have.been.calledWith(fakeInput);
      expect(result).to.eql({ artifact_security_scan_id: 'scan-new' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateArtifactSecurityScan = {
        artifact_security_id: 'security-1',
        scan_status: ProcessStatusStatusEnum.PENDING,
        scanner_version: 'v1',
        scanned_at: '2025-01-01T00:00:00Z',
        results: {}
      };

      sinon
        .stub(ArtifactSecurityScanRepository.prototype, 'insertArtifactSecurityScan')
        .throws(new Error('Insert failed'));

      try {
        await service.insertArtifactSecurityScan(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('updateArtifactSecurityScan', () => {
    it('should update an existing scan record and return its ID', async () => {
      const fakeInput: UpdateArtifactSecurityScan = {
        scan_status: ProcessStatusStatusEnum.COMPLETED,
        scanner_version: 'v2',
        scanned_at: '2025-02-01T00:00:00Z',
        results: { reason: 'malware detected' }
      };

      const stub = sinon
        .stub(ArtifactSecurityScanRepository.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });

      const result = await service.updateArtifactSecurityScan('scan-1', fakeInput);

      expect(stub).to.have.been.calledWith('scan-1', fakeInput);
      expect(result).to.eql({ artifact_security_scan_id: 'scan-1' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateArtifactSecurityScan = {
        scan_status: ProcessStatusStatusEnum.COMPLETED,
        scanner_version: 'v2',
        scanned_at: '2025-02-01T00:00:00Z',
        results: { reason: 'malware detected' }
      };

      sinon
        .stub(ArtifactSecurityScanRepository.prototype, 'updateArtifactSecurityScan')
        .throws(new Error('Update failed'));

      try {
        await service.updateArtifactSecurityScan('scan-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });
});
