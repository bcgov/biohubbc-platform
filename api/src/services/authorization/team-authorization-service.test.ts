import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamAuthorizationRepository } from '../../repositories/authorization/team-authorization-repository';
import { TeamAuthorizationService } from './team-authorization-service';

chai.use(sinonChai);

describe('TeamAuthorizationService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('isUserAuthorizedForTeamEntity', () => {
    describe('entity: ticket', () => {
      it('returns false when no system user is provided', async () => {
        const mockConnection = getMockDBConnection();
        const repositoryStub = sinon.stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByTicket');

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(null, {
          entity: 'ticket',
          ticketId: '11111111-1111-1111-1111-111111111111'
        });

        expect(result).to.be.false;
        expect(repositoryStub).not.to.have.been.called;
      });

      it('returns true when the user has active team access to the ticket', async () => {
        const mockConnection = getMockDBConnection();
        sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByTicket')
          .resolves({ ticket_id: '11111111-1111-1111-1111-111111111111', record_end_date: null });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'ticket',
          ticketId: '11111111-1111-1111-1111-111111111111'
        });

        expect(result).to.be.true;
      });

      it('returns false when the user does not have team access to the ticket', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByTicket').resolves(null);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'ticket',
          ticketId: '11111111-1111-1111-1111-111111111111'
        });

        expect(result).to.be.false;
      });

      it('returns false when the ticket team membership has expired', async () => {
        const mockConnection = getMockDBConnection();
        sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByTicket')
          .resolves({ ticket_id: '11111111-1111-1111-1111-111111111111', record_end_date: '2025-01-01' });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'ticket',
          ticketId: '11111111-1111-1111-1111-111111111111'
        });

        expect(result).to.be.false;
      });
    });

    describe('entity: data_request', () => {
      it('returns true when the user has active team access to the data request', async () => {
        const mockConnection = getMockDBConnection();
        sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByDataRequest')
          .resolves({ data_request_id: 'dr-1', record_end_date: null });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'data_request',
          dataRequestId: 'dr-1'
        });

        expect(result).to.be.true;
      });

      it('returns false when the user does not have team access to the data request', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByDataRequest').resolves(null);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'data_request',
          dataRequestId: 'dr-1'
        });

        expect(result).to.be.false;
      });

      it('returns false when the team membership has expired', async () => {
        const mockConnection = getMockDBConnection();
        sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByDataRequest')
          .resolves({ data_request_id: 'dr-1', record_end_date: '2025-01-01' });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'data_request',
          dataRequestId: 'dr-1'
        });

        expect(result).to.be.false;
      });
    });

    describe('entity: submission_upload', () => {
      const submissionUploadId = '11111111-1111-1111-1111-111111111111';

      it('returns true when the user has active team access to the submission upload', async () => {
        const mockConnection = getMockDBConnection();
        const repositoryStub = sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipBySubmissionUpload')
          .resolves({ submission_upload_id: submissionUploadId, record_end_date: null });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission_upload',
          submissionUploadId
        });

        expect(result).to.be.true;
        expect(repositoryStub).to.have.been.calledOnceWith(1, submissionUploadId);
      });

      it('returns false when the user does not have team access to the submission upload', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipBySubmissionUpload').resolves(null);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission_upload',
          submissionUploadId
        });

        expect(result).to.be.false;
      });
    });

    describe('entity: submission', () => {
      it('returns true when the user has active team access to the submission', async () => {
        const mockConnection = getMockDBConnection();
        const repositoryStub = sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipBySubmissionId')
          .resolves({ submission_id: 10, record_end_date: null });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission',
          submissionId: 10
        });

        expect(result).to.be.true;
        expect(repositoryStub).to.have.been.calledOnceWith(1, 10);
      });

      it('returns false when the user does not have team access to the submission', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipBySubmissionId').resolves(null);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission',
          submissionId: 10
        });

        expect(result).to.be.false;
      });

      it('resolves submission-team access by UUID when explicitly provided a submission UUID', async () => {
        const submissionUuid = '11111111-1111-1111-1111-111111111111';
        const mockConnection = getMockDBConnection();
        const repositoryStub = sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipBySubmissionUuid')
          .resolves({ submission_id: 10, record_end_date: null });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission',
          submissionUuid
        });

        expect(result).to.be.true;
        expect(repositoryStub).to.have.been.calledOnceWith(1, submissionUuid);
      });
    });

    describe('entity: download', () => {
      it('delegates to download team authorization with a nullable system user id', async () => {
        const mockConnection = getMockDBConnection();
        const repositoryStub = sinon
          .stub(TeamAuthorizationRepository.prototype, 'isUserAuthorizedForDownload')
          .resolves(true);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(null, {
          entity: 'download',
          downloadId: 'aaaa0000-0000-0000-0000-000000000001'
        });

        expect(result).to.be.true;
        expect(repositoryStub).to.have.been.calledOnceWith(null, 'aaaa0000-0000-0000-0000-000000000001');
      });
    });
  });

  describe('isSubmissionFeatureAccessibleToUser', () => {
    it('delegates to the repository and returns its result, passing the ids through', async () => {
      const mockConnection = getMockDBConnection();
      const repoStub = sinon
        .stub(TeamAuthorizationRepository.prototype, 'isSubmissionFeatureAccessibleToUser')
        .resolves(true);

      const service = new TeamAuthorizationService(mockConnection);
      const result = await service.isSubmissionFeatureAccessibleToUser(1, 2, 3);

      expect(result).to.be.true;
      expect(repoStub).to.have.been.calledOnceWith(1, 2, 3);
    });

    it('passes a null system user id through for anonymous users', async () => {
      const mockConnection = getMockDBConnection();
      const repoStub = sinon
        .stub(TeamAuthorizationRepository.prototype, 'isSubmissionFeatureAccessibleToUser')
        .resolves(false);

      const service = new TeamAuthorizationService(mockConnection);
      const result = await service.isSubmissionFeatureAccessibleToUser(null, 2, 3);

      expect(result).to.be.false;
      expect(repoStub).to.have.been.calledOnceWith(null, 2, 3);
    });
  });
});
