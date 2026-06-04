import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  createMockDownloadExportListRow,
  createMockDownloadRecord,
  createMockDownloadVersion
} from '../../__mocks__/download';
import { HTTP400, HTTP403, HTTP404, HTTP409 } from '../../errors/http-error';
import { CreateDownload } from '../../models/download';
import { ExpressionTree } from '../../models/expression-tree';
import { DownloadExportRepository } from '../../repositories/download/download-export-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { TeamService } from '../access-policy/team-service';
import { ExpressionTreeService } from '../expression-tree-service';
import { DownloadPolicyService } from './download-policy-service';
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
      policyId: 'pppp0000-0000-0000-0000-000000000001',
      format: 'parquet',
      requestedBy: 42
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
  });

  describe('createDownloadRequest', () => {
    const validExpression: ExpressionTree = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          feature_type_property_id: 2,
          operator: 'Equals',
          value: 'moose'
        }
      ]
    };

    const basePayload = (overrides: Partial<Parameters<DownloadService['createDownloadRequest']>[0]> = {}) => ({
      name: 'My download',
      description: 'A description',
      featureTypes: ['observation'],
      expression: validExpression,
      requestedBy: 42,
      ...overrides
    });

    it('orchestrates expression → policy → download → team link → publish in order for an authenticated user', async () => {
      // Verifies: authenticated path links a team, never creates an export at request time,
      // and runs the steps in the required order ending with the worker publish.

      // Step 1: Stub each orchestration dependency in sequence
      const writeExpressionTreeStub = sinon
        .stub(ExpressionTreeService.prototype, 'writeExpressionTree')
        .resolves({ expression_id: 'expr-uuid-1' });
      const createDownloadPolicyStub = sinon
        .stub(DownloadPolicyService.prototype, 'createDownloadPolicy')
        .resolves({ policy_id: 'policy-uuid-1' });
      const createDownloadStub = sinon
        .stub(DownloadRepository.prototype, 'createDownload')
        .resolves({ download_id: 'download-uuid-1' });
      const createExportStub = sinon.stub(DownloadExportRepository.prototype, 'createDownloadExport');
      const createVersionStub = sinon
        .stub(DownloadVersionRepository.prototype, 'createDownloadVersion')
        .resolves(createMockDownloadVersion({ download_version_id: 'ver-1', download_id: 'download-uuid-1' }));
      const setCurrentStub = sinon.stub(DownloadVersionRepository.prototype, 'setCurrentDownloadVersion').resolves();
      const publishStub = sinon.stub(DownloadService.dependencies, 'publishProcessDownloadJob').resolves({
        status: 'published',
        jobId: 'job-1'
      });

      // Step 2: Create the service and stub its team-link helper
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);
      const linkStub = sinon.stub(service, 'linkDownloadToNewTeam').resolves();

      // Step 3: Run the authenticated create request
      const result = await service.createDownloadRequest(basePayload());

      // Step 4: Authenticated requests return the download id only
      expect(result).to.eql({ download_id: 'download-uuid-1' });

      // Step 5: Verify each dependency received the values the service decided to pass
      expect(writeExpressionTreeStub).to.have.been.calledOnceWith(validExpression);
      expect(createDownloadPolicyStub).to.have.been.calledOnceWith({
        name: 'My download',
        description: 'A description',
        featureTypes: ['observation'],
        expressionId: 'expr-uuid-1'
      });
      expect(createDownloadStub).to.have.been.calledOnceWith({
        policyId: 'policy-uuid-1',
        format: 'parquet',
        requestedBy: 42
      });
      expect(linkStub).to.have.been.calledOnce;
      expect(linkStub.firstCall.args[0]).to.equal('download-uuid-1');
      expect(linkStub.firstCall.args[1]).to.equal(42);

      // Step 6: The request flow must NOT create an export — that is a separate user action
      expect(createExportStub).to.not.have.been.called;

      // Step 7: Verify the worker job was queued exactly once with the new download id
      expect(publishStub).to.have.been.calledOnce;
      expect(publishStub.firstCall.args[1]).to.eql({ downloadId: 'download-uuid-1' });

      // Step 8: Verify the required call order — the version is materialized between the
      // download insert and the team link, and the publish is last.
      expect(writeExpressionTreeStub).to.have.been.calledBefore(createDownloadPolicyStub);
      expect(createDownloadPolicyStub).to.have.been.calledBefore(createDownloadStub);
      expect(createDownloadStub).to.have.been.calledBefore(createVersionStub);
      expect(createVersionStub).to.have.been.calledBefore(setCurrentStub);
      expect(setCurrentStub).to.have.been.calledBefore(linkStub);
      expect(linkStub).to.have.been.calledBefore(publishStub);
    });

    it('materializes a download version and points the download at it before publishing', async () => {
      // Verifies: createDownloadRequest creates the version off the new download_id, flips the
      // current-version pointer with the returned version id, and orders both writes between the
      // download insert and the worker publish (version must exist before the pointer UPDATE).

      // Step 1: Stub the orchestration dependencies up to the download insert
      sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-uuid-1' });
      sinon.stub(DownloadPolicyService.prototype, 'createDownloadPolicy').resolves({ policy_id: 'policy-uuid-1' });
      const createDownloadStub = sinon
        .stub(DownloadRepository.prototype, 'createDownload')
        .resolves({ download_id: 'download-uuid-1' });

      // Step 2: Stub the version repo — createDownloadVersion returns the new version row, and the
      // pointer UPDATE resolves.
      const createVersionStub = sinon
        .stub(DownloadVersionRepository.prototype, 'createDownloadVersion')
        .resolves(createMockDownloadVersion({ download_version_id: 'ver-1', download_id: 'download-uuid-1' }));
      const setCurrentStub = sinon.stub(DownloadVersionRepository.prototype, 'setCurrentDownloadVersion').resolves();

      // Step 3: Stub the team link + publish (the tail of the flow)
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);
      sinon.stub(service, 'linkDownloadToNewTeam').resolves();
      const publishStub = sinon.stub(DownloadService.dependencies, 'publishProcessDownloadJob').resolves({
        status: 'published',
        jobId: 'job-1'
      });

      // Step 4: Run the create request
      await service.createDownloadRequest(basePayload());

      // Step 5: Both version writes fire exactly once
      expect(createVersionStub).to.have.been.calledOnce;
      expect(setCurrentStub).to.have.been.calledOnce;

      // Step 6: The version is created off the download_id returned by createDownload, and the
      // pointer is set with that download_id + the returned version id.
      expect(createVersionStub).to.have.been.calledOnceWith('download-uuid-1');
      expect(setCurrentStub).to.have.been.calledOnceWith('download-uuid-1', 'ver-1');

      // Step 7: Ordering — download insert → version create → set-current → publish
      expect(createDownloadStub).to.have.been.calledBefore(createVersionStub);
      expect(createVersionStub).to.have.been.calledBefore(setCurrentStub);
      expect(setCurrentStub).to.have.been.calledBefore(publishStub);
    });

    it('skips the team link and does not create an export for an anonymous request (requestedBy null)', async () => {
      // Verifies: the anonymous branch returns the download id only, does NOT link a team, and
      // does NOT create an export — the UUID is the credential and any later export is a
      // separate user-initiated action.

      // Step 1: Stub the orchestration dependencies up to the download insert
      sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-uuid-1' });
      sinon.stub(DownloadPolicyService.prototype, 'createDownloadPolicy').resolves({ policy_id: 'policy-uuid-1' });
      sinon.stub(DownloadRepository.prototype, 'createDownload').resolves({ download_id: 'download-uuid-1' });

      // Step 2: Stub the export repo to detect any (wrong) call
      const createExportStub = sinon.stub(DownloadExportRepository.prototype, 'createDownloadExport');
      sinon
        .stub(DownloadVersionRepository.prototype, 'createDownloadVersion')
        .resolves(createMockDownloadVersion({ download_version_id: 'ver-1', download_id: 'download-uuid-1' }));
      sinon.stub(DownloadVersionRepository.prototype, 'setCurrentDownloadVersion').resolves();
      const publishStub = sinon.stub(DownloadService.dependencies, 'publishProcessDownloadJob').resolves({
        status: 'published',
        jobId: 'job-1'
      });

      // Step 3: Create the service and stub the team-link helper to detect any (wrong) call
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);
      const linkStub = sinon.stub(service, 'linkDownloadToNewTeam').resolves();

      // Step 4: Run the create request with no security identity
      const result = await service.createDownloadRequest(basePayload({ requestedBy: null }));

      // Step 5: Anonymous downloads get no team — the UUID is the credential
      expect(linkStub).to.not.have.been.called;

      // Step 6: No export is created at request time — that is a separate user-initiated action
      expect(createExportStub).to.not.have.been.called;

      // Step 7: The result is the download id only
      expect(result).to.eql({ download_id: 'download-uuid-1' });

      // Step 8: The worker job is still queued exactly once
      expect(publishStub).to.have.been.calledOnceWith(mockDBConnection, { downloadId: 'download-uuid-1' });
    });

    it('skips writeExpressionTree and passes expressionId=null when expression is null', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      const writeExpressionTreeStub = sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree');
      const createDownloadPolicyStub = sinon
        .stub(DownloadPolicyService.prototype, 'createDownloadPolicy')
        .resolves({ policy_id: 'policy-uuid-2' });
      sinon.stub(DownloadRepository.prototype, 'createDownload').resolves({ download_id: 'download-uuid-2' });
      sinon
        .stub(DownloadVersionRepository.prototype, 'createDownloadVersion')
        .resolves(createMockDownloadVersion({ download_version_id: 'ver-2', download_id: 'download-uuid-2' }));
      sinon.stub(DownloadVersionRepository.prototype, 'setCurrentDownloadVersion').resolves();
      sinon.stub(service, 'linkDownloadToNewTeam').resolves();
      sinon.stub(DownloadService.dependencies, 'publishProcessDownloadJob').resolves({
        status: 'published',
        jobId: 'job-2'
      });

      await service.createDownloadRequest(basePayload({ expression: null }));

      expect(writeExpressionTreeStub).to.not.have.been.called;
      expect(createDownloadPolicyStub.firstCall.args[0]).to.include({ expressionId: null });
    });

    it('propagates HTTP400 from createDownloadPolicy without queuing the job', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-uuid' });
      sinon
        .stub(DownloadPolicyService.prototype, 'createDownloadPolicy')
        .rejects(new HTTP400('Unknown feature type(s)'));
      const createDownloadStub = sinon.stub(DownloadRepository.prototype, 'createDownload');
      const publishStub = sinon.stub(DownloadService.dependencies, 'publishProcessDownloadJob');

      try {
        await service.createDownloadRequest(basePayload());
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect(createDownloadStub).to.not.have.been.called;
        expect(publishStub).to.not.have.been.called;
      }
    });

    it('propagates errors from createDownload without linking a team or queuing the job', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadService(mockDBConnection);

      sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-uuid' });
      sinon.stub(DownloadPolicyService.prototype, 'createDownloadPolicy').resolves({ policy_id: 'policy-uuid' });
      sinon.stub(DownloadRepository.prototype, 'createDownload').rejects(new Error('Download creation failed'));
      const linkStub = sinon.stub(service, 'linkDownloadToNewTeam').resolves();
      const publishStub = sinon.stub(DownloadService.dependencies, 'publishProcessDownloadJob');

      try {
        await service.createDownloadRequest(basePayload());
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Download creation failed');
        expect(linkStub).to.not.have.been.called;
        expect(publishStub).to.not.have.been.called;
      }
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
        'Team for download aaaa0000-0000-0000-0000-000000000042',
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
});
