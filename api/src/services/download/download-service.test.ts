import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockDownloadExportListRow, createMockDownloadRecord } from '../../__mocks__/download';
import { HTTP403, HTTP404, HTTP409 } from '../../errors/http-error';
import { CreateDownload } from '../../models/download';
import { DownloadExportRepository } from '../../repositories/download/download-export-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';
import { TeamService } from '../access-policy/team-service';
import { DownloadService, groupExportsByDownloadId } from './download-service';

chai.use(sinonChai);

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
    it('short-circuits on empty page and does not fetch exports', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const listStub = sinon
        .stub(DownloadRepository.prototype, 'getDownloadsByTeamMembership')
        .resolves({ downloads: [], count: 0 });
      const exportsStub = sinon
        .stub(DownloadExportRepository.prototype, 'listDownloadExportsByDownloadIds')
        .resolves([]);

      const result = await service.getDownloadsByTeamMembership(42);

      expect(listStub).to.have.been.calledOnceWith(42);
      expect(exportsStub).not.to.have.been.called;
      expect(result).to.deep.equal({ downloads: [], count: 0 });
    });

    it('attaches exports to each download grouped by download_id', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const baseA = createMockDownloadRecord({ download_id: 'a' });
      const baseB = createMockDownloadRecord({ download_id: 'b' });

      const exportA1 = createMockDownloadExportListRow({
        download_export_id: 'ex-a1',
        download_id: 'a',
        part_count: 2
      });
      const exportA2 = createMockDownloadExportListRow({
        download_export_id: 'ex-a2',
        download_id: 'a',
        part_count: 0
      });
      // b has no exports — service must fall through to `[]`.

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadsByTeamMembership')
        .resolves({ downloads: [baseA, baseB], count: 2 });
      sinon.stub(DownloadExportRepository.prototype, 'listDownloadExportsByDownloadIds').resolves([exportA1, exportA2]);

      const result = await service.getDownloadsByTeamMembership(42);

      expect(result.count).to.equal(2);
      expect(result.downloads).to.have.length(2);
      expect(result.downloads[0].download_id).to.equal('a');
      expect(result.downloads[0].exports).to.deep.equal([exportA1, exportA2]);
      expect(result.downloads[1].download_id).to.equal('b');
      expect(result.downloads[1].exports).to.deep.equal([]);
    });

    it('preserves the download page order from the repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const first = createMockDownloadRecord({ download_id: 'first' });
      const second = createMockDownloadRecord({ download_id: 'second' });

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadsByTeamMembership')
        .resolves({ downloads: [first, second], count: 2 });
      sinon.stub(DownloadExportRepository.prototype, 'listDownloadExportsByDownloadIds').resolves([]);

      const result = await service.getDownloadsByTeamMembership(42);

      expect(result.downloads.map((d) => d.download_id)).to.deep.equal(['first', 'second']);
    });

    it('passes the full set of download ids to the exports batch fetch', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const ids = ['one', 'two', 'three'];

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadsByTeamMembership')
        .resolves({ downloads: ids.map((id) => createMockDownloadRecord({ download_id: id })), count: 3 });
      const exportsStub = sinon
        .stub(DownloadExportRepository.prototype, 'listDownloadExportsByDownloadIds')
        .resolves([]);

      await service.getDownloadsByTeamMembership(42);

      expect(exportsStub).to.have.been.calledOnceWith(ids);
    });
  });

  describe('groupExportsByDownloadId (pure helper)', () => {
    it('returns an empty map for an empty input', () => {
      expect(groupExportsByDownloadId([])).to.deep.equal(new Map());
    });

    it('groups rows by download_id preserving input order within each group', () => {
      const a1 = createMockDownloadExportListRow({ download_export_id: 'a1', download_id: 'a' });
      const a2 = createMockDownloadExportListRow({ download_export_id: 'a2', download_id: 'a' });
      const b1 = createMockDownloadExportListRow({ download_export_id: 'b1', download_id: 'b' });

      const grouped = groupExportsByDownloadId([a1, a2, b1]);

      expect(grouped.get('a')).to.deep.equal([a1, a2]);
      expect(grouped.get('b')).to.deep.equal([b1]);
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

  describe('createDownload', () => {
    const mockPayload: CreateDownload = {
      cartId: 'aaaa0000-0000-0000-0000-000000000001',
      format: 'parquet'
    };

    it('delegates to downloadRepository.createDownload and returns its result', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const createDownloadStub = sinon
        .stub(DownloadRepository.prototype, 'createDownload')
        .resolves({ download_id: 'dl-uuid-1' });

      const result = await service.createDownload(mockPayload);

      expect(result).to.deep.equal({ download_id: 'dl-uuid-1' });
      expect(createDownloadStub).to.have.been.calledOnceWith(mockPayload);
    });

    it('does not create an artifact at request time', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'createDownload').resolves({ download_id: 'dl-uuid-1' });
      const createDownloadArtifactSpy = sinon.spy(DownloadRepository.prototype, 'createDownloadArtifact');

      await service.createDownload(mockPayload);

      expect(createDownloadArtifactSpy).to.not.have.been.called;
    });
  });

  describe('createDownloadTeam', () => {
    it('delegates to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const stub = sinon.stub(DownloadRepository.prototype, 'createDownloadTeam').resolves();

      await service.createDownloadTeam('dl-uuid', 'team-uuid');

      expect(stub).to.have.been.calledOnceWith('dl-uuid', 'team-uuid');
    });
  });

  describe('getAuthorizedDownload', () => {
    it('returns download when anonymous (no teams)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);
      const mockDownload = createMockDownloadRecord();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(mockDownload);
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(false);

      const result = await service.getAuthorizedDownload('aaaa0000-0000-0000-0000-000000000042', null);

      expect(result).to.eql(mockDownload);
    });

    it('returns download when user is authorized team member', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);
      const mockDownload = createMockDownloadRecord();

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(mockDownload);
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(true);
      sinon.stub(DownloadRepository.prototype, 'isUserAuthorizedForDownload').resolves(true);

      const result = await service.getAuthorizedDownload('aaaa0000-0000-0000-0000-000000000042', 42);

      expect(result).to.eql(mockDownload);
    });

    it('throws HTTP404 when download not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(null);

      try {
        await service.getAuthorizedDownload('nonexistent', null);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP404);
      }
    });

    it('throws HTTP403 when unauthenticated user accesses team-based download', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(true);

      try {
        await service.getAuthorizedDownload('aaaa0000-0000-0000-0000-000000000042', null);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });

    it('throws HTTP403 when user is not a team member', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(true);
      sinon.stub(DownloadRepository.prototype, 'isUserAuthorizedForDownload').resolves(false);

      try {
        await service.getAuthorizedDownload('aaaa0000-0000-0000-0000-000000000042', 99);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });
  });

  describe('linkDownloadToNewTeam', () => {
    it('creates a team and links it to the download', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const createTeamStub = sinon
        .stub(TeamService.prototype, 'createTeam')
        .resolves({ team_id: 'team-1', name: 'Team for bulk dl-uuid', description: 'desc', member_count: 1 });
      const createDownloadTeamStub = sinon.stub(DownloadRepository.prototype, 'createDownloadTeam').resolves();

      await service.linkDownloadToNewTeam('dl-uuid', 42, 'Team for bulk dl-uuid', 'Team for download');

      expect(createTeamStub).to.have.been.calledOnceWith({
        name: 'Team for bulk dl-uuid',
        description: 'Team for download',
        system_user_ids: [42]
      });
      expect(createDownloadTeamStub).to.have.been.calledOnceWith('dl-uuid', 'team-1');
    });
  });

  describe('claimDownload', () => {
    it('creates team and links when download is anonymous (no teams)', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(false);
      const linkStub = sinon.stub(service, 'linkDownloadToNewTeam').resolves();

      await service.claimDownload('aaaa0000-0000-0000-0000-000000000042', 42);

      expect(linkStub).to.have.been.calledOnceWith(
        'aaaa0000-0000-0000-0000-000000000042',
        42,
        'Team for cart aaaa0000-0000-0000-0000-000000000042',
        'Team created when claiming anonymous download'
      );
    });

    it('throws HTTP404 when download not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(null);

      try {
        await service.claimDownload('nonexistent', 42);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP404);
      }
    });

    it('throws HTTP409 when download already has teams', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(DownloadRepository.prototype, 'findDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(DownloadRepository.prototype, 'isDownloadClaimedByTeam').resolves(true);

      try {
        await service.claimDownload('aaaa0000-0000-0000-0000-000000000042', 42);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }
    });
  });

  describe('getDownloadFeatures', () => {
    it('resolves features from cart when cart_id is set', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const features = [
        { submission_feature_id: 1, submission_id: 100, feature_type_name: 'dataset', estimated_byte_size: '500' },
        { submission_feature_id: 2, submission_id: 100, feature_type_name: 'observation', estimated_byte_size: '300' }
      ];

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ cart_id: 'cart-uuid', filters: null, create_user: 1 });
      const cartStub = sinon.stub(DownloadRepository.prototype, 'getDownloadFeaturesByCartId').resolves(features);
      const searchStub = sinon.stub(DownloadRepository.prototype, 'getDownloadFeaturesBySearchQuery');

      const result = await service.getDownloadFeatures('dl-1');

      expect(result).to.have.length(2);
      expect(cartStub).to.have.been.calledOnceWith('cart-uuid');
      expect(searchStub).to.not.have.been.called;
    });

    it('resolves features from search query when filters are set', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const features = [
        { submission_feature_id: 3, submission_id: 200, feature_type_name: 'observation', estimated_byte_size: '100' }
      ];

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ cart_id: null, filters: { keyword: 'moose' }, create_user: 5 });
      const mockSubquery = {} as any;
      const buildStub = sinon
        .stub(SearchFeatureRepository.prototype, 'buildSearchFeatureIdsSubquery')
        .returns(mockSubquery);
      const searchStub = sinon
        .stub(DownloadRepository.prototype, 'getDownloadFeaturesBySearchQuery')
        .resolves(features);
      const cartStub = sinon.stub(DownloadRepository.prototype, 'getDownloadFeaturesByCartId');

      const result = await service.getDownloadFeatures('dl-1');

      expect(result).to.have.length(1);
      expect(buildStub).to.have.been.calledOnceWith({ keyword: 'moose' }, 5);
      expect(searchStub).to.have.been.calledOnceWith(mockSubquery);
      expect(cartStub).to.not.have.been.called;
    });

    it('throws when download has neither cart_id nor filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon
        .stub(DownloadRepository.prototype, 'getDownloadSource')
        .resolves({ cart_id: null, filters: null, create_user: 1 });

      try {
        await service.getDownloadFeatures('dl-1');
        expect.fail('Expected an error');
      } catch (error) {
        expect((error as Error).message).to.include('has neither cart_id nor filters');
      }
    });
  });
});
