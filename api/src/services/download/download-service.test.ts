import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { DownloadService } from './download-service';

describe('DownloadService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findDownloadById', () => {
    it('delegates to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const stub = sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(null);

      const result = await service.findDownloadById('aaaa0000-0000-0000-0000-000000000001');

      expect(stub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001');
      expect(result).to.be.null;
    });
  });

  describe('getDownloadsByTeamMembership', () => {
    it('delegates to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const stub = sinon.stub(DownloadRepository.prototype, 'getDownloadsByTeamMembership').resolves([]);

      const result = await service.getDownloadsByTeamMembership(42);

      expect(stub).to.have.been.calledOnceWith(42);
      expect(result).to.deep.equal([]);
    });

    it('passes through DownloadListRecord fields including create_date and feature_count', async () => {
      // Verifies: Service doesn't transform or drop new fields

      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const mockRecords = [
        {
          download_id: 'aaaa0000-0000-0000-0000-000000000001',
          system_user_id: 42,
          team_id: null,
          data_request_id: null,
          download_status: 'ready' as const,
          metadata: null,
          started_at: '2025-01-01T00:00:00Z',
          completed_at: '2025-01-01T00:01:00Z',
          downloaded_at: null,
          total_fragments: 1,
          completed_fragments: 1,
          estimated_total_size_bytes: '1000',
          fragment_size_bytes: '524288000',
          create_date: '2025-01-01T00:00:00Z',
          feature_count: 5
        }
      ];

      sinon.stub(DownloadRepository.prototype, 'getDownloadsByTeamMembership').resolves(mockRecords);

      const result = await service.getDownloadsByTeamMembership(42);

      expect(result).to.have.length(1);
      expect(result[0]).to.have.property('create_date', '2025-01-01T00:00:00Z');
      expect(result[0]).to.have.property('feature_count', 5);
    });
  });

  describe('markDownloadAsDownloaded', () => {
    it('delegates to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const stub = sinon.stub(DownloadRepository.prototype, 'markDownloadAsDownloaded').resolves();

      await service.markDownloadAsDownloaded('aaaa0000-0000-0000-0000-000000000001');

      expect(stub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001');
    });
  });
});
