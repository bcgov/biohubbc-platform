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

    describe('entity: submission_feature', () => {
      it('returns true when the feature is accessible to the user, passing through the entity ids', async () => {
        const mockConnection = getMockDBConnection();
        const accessibleStub = sinon
          .stub(TeamAuthorizationRepository.prototype, 'isSubmissionFeatureAccessibleToUser')
          .resolves(true);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission_feature',
          submissionFeatureId: 2,
          submissionId: 3
        });

        expect(result).to.be.true;
        expect(accessibleStub).to.have.been.calledOnceWith(1, 2, 3);
      });

      it('returns false when the feature is not accessible to the user', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(TeamAuthorizationRepository.prototype, 'isSubmissionFeatureAccessibleToUser').resolves(false);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission_feature',
          submissionFeatureId: 2,
          submissionId: 3
        });

        expect(result).to.be.false;
      });
    });
  });
});
