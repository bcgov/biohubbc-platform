import chai, { expect } from 'chai';
import { Request, RequestHandler } from 'express';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getRequestHandlerMocks, registerMockDBConnection } from '../../__mocks__/db';
import { HTTPError } from '../../errors/http-error';
import { SystemUserExtended } from '../../models/system-user';
import { GET as history } from '../../paths/submission/{submissionUuid}/history';
import { DELETE as deletion } from '../../paths/submission/{submissionUuid}/upload/{submissionUploadId}';
import { TeamAuthorizationRepository } from '../../repositories/authorization/team-authorization-repository';
import { ContributorRepository } from '../../repositories/contributor-repository';
import { AuthorizationService } from '../../services/authorization/authorization-service';
import { TeamAuthorizationService } from '../../services/authorization/team-authorization-service';
import { ContributorSystemUserService } from '../../services/contributor-system-user-service';
import * as authorization from './authorization';

chai.use(sinonChai);

describe('authorizeRequestHandler', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('throws a 403 error if the user is not authorized', async function () {
    registerMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(authorization.authorizationDependencies, 'authorizeRequest').resolves(false);

    const mockAuthorizationSchemeCallback = () => {
      return { or: [] };
    };

    const requestHandler = authorization.authorizeRequestHandler(mockAuthorizationSchemeCallback);

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (error) {
      expect((error as HTTPError).message).to.equal('Access Denied');
      expect((error as HTTPError).status).to.equal(403);
    }

    expect(mockNext).not.to.have.been.called;
  });

  it('calls next if the user is authorized', async function () {
    registerMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(authorization.authorizationDependencies, 'authorizeRequest').resolves(true);

    const mockAuthorizationSchemeCallback = () => {
      return { or: [] };
    };

    const requestHandler = authorization.authorizeRequestHandler(mockAuthorizationSchemeCallback);

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockNext).to.have.been.calledOnce;
  });
});

describe('authorizeRequest', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if systemUserObject is null', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = undefined as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(false);
  });

  it('returns true if the user is a system administrator', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = { role_names: [] } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(true);
    sinon.stub(AuthorizationService.prototype, 'executeAuthorizationScheme').resolves(false);

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
  });

  it('calls executeAuthorizationScheme even if the user is a system administrator', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = { role_names: [] } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(true);
    const executeAuthorizationSchemeStub = sinon
      .stub(AuthorizationService.prototype, 'executeAuthorizationScheme')
      .resolves(false);

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
    expect(executeAuthorizationSchemeStub).to.have.been.calledOnce;
  });

  it('returns true if the authorization_scheme is undefined', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = { role_names: [] } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(false);

    const mockReq = { authorization_scheme: undefined } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
  });

  it('returns true if the user is authorized against the authorization_scheme', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = { role_names: [] } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(false);

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizationScheme').resolves(true);

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
  });

  it('returns true for a direct single-rule authorization scheme', async function () {
    registerMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(false);
    sinon.stub(AuthorizationService.prototype, 'executeAuthorizationScheme').resolves(true);

    const mockReq = { authorization_scheme: { discriminator: 'Contributor' } } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
  });

  it('returns false if the user is not authorized against the authorization_scheme', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = { role_names: [] } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(false);

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizationScheme').resolves(false);

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(false);
  });

  it('returns false if an error is thrown', async function () {
    registerMockDBConnection({
      open: sinon.stub().callsFake(() => {
        throw new Error('Test Error');
      })
    });

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(false);
  });

  it('allows system admin bypass for contributor authorization', async function () {
    registerMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(true);
    sinon.stub(AuthorizationService.prototype, 'executeAuthorizationScheme').resolves(false);

    const mockReq = { authorization_scheme: { discriminator: 'Contributor' } } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
  });

  for (const isAdministrator of [false, true]) {
    it(`resolves selected contributor membership once for the authenticated user (admin=${isAdministrator})`, async () => {
      registerMockDBConnection({ systemUserId: () => 999 });
      const membership = sinon
        .stub(ContributorRepository.prototype, 'findContributorMembershipByClientId')
        .withArgs('selected', 12)
        .resolves({ contributor_id: 77, is_member: true });
      const generalMembership = sinon.stub(ContributorSystemUserService.prototype, 'hasActiveContributor');
      const req = {
        authorization_scheme: { or: [{ discriminator: 'Contributor', clientId: 'selected' }] },
        keycloak_token: { sub: 'guid' },
        system_user: { system_user_id: 12, role_names: isAdministrator ? ['System Administrator'] : [] }
      } as unknown as Request;

      expect(await authorization.authorizeRequest(req)).to.be.true;
      expect(req.contributor_id).to.equal(77);
      expect(membership).to.have.been.calledOnceWithExactly('selected', 12);
      expect(generalMembership).not.to.have.been.called;
    });

    for (const contributor of [undefined, { contributor_id: 77, is_member: false }]) {
      it(`rejects an unavailable or unauthorized selected contributor (admin=${isAdministrator}, found=${!!contributor})`, async () => {
        registerMockDBConnection();
        sinon.stub(ContributorRepository.prototype, 'findContributorMembershipByClientId').resolves(contributor);
        const req = {
          authorization_scheme: { or: [{ discriminator: 'Contributor', clientId: 'selected' }] },
          keycloak_token: { sub: 'guid' },
          system_user: { system_user_id: 12, role_names: isAdministrator ? ['System Administrator'] : [] }
        } as unknown as Request;

        expect(await authorization.authorizeRequest(req)).to.be.false;
        expect(req.contributor_id).to.be.undefined;
      });
    }
  }

  for (const clientId of [null, '', '   ']) {
    it(`rejects an invalid effective client ID (${clientId}) without querying contributors`, async () => {
      registerMockDBConnection();
      const membership = sinon.stub(ContributorRepository.prototype, 'findContributorMembershipByClientId');
      const req = {
        authorization_scheme: { or: [{ discriminator: 'Contributor', clientId }] },
        keycloak_token: { sub: 'guid' },
        system_user: { system_user_id: 12, role_names: ['System Administrator'] }
      } as unknown as Request;

      expect(await authorization.authorizeRequest(req)).to.be.false;
      expect(membership).not.to.have.been.called;
    });
  }

  for (const teamMember of [false, true]) {
    for (const contributorMember of [false, true]) {
      for (const isAdministrator of [false, true]) {
        it(`composes submission team=${teamMember} and contributor=${contributorMember} with admin=${isAdministrator}`, async () => {
          registerMockDBConnection();
          const submissionUuid = '11111111-1111-1111-1111-111111111111';
          const team = sinon
            .stub(TeamAuthorizationService.prototype, 'isUserAuthorizedForTeamEntity')
            .resolves(teamMember);
          const contributor = sinon
            .stub(ContributorRepository.prototype, 'findContributorMembershipByClientId')
            .resolves({ contributor_id: 77, is_member: contributorMember });
          const req = {
            authorization_scheme: {
              and: [
                { discriminator: 'Team', entity: 'submission', submissionUuid },
                { discriminator: 'Contributor', clientId: 'selected-client' }
              ]
            },
            keycloak_token: { clientId: 'unrelated-client' },
            system_user: { system_user_id: 12, role_names: isAdministrator ? ['System Administrator'] : [] }
          } as unknown as Request;

          expect(await authorization.authorizeRequest(req)).to.equal(
            contributorMember && (isAdministrator || teamMember)
          );
          expect(team).to.have.been.calledOnceWithExactly(12, {
            discriminator: 'Team',
            entity: 'submission',
            submissionUuid
          });
          expect(contributor).to.have.been.calledOnceWithExactly('selected-client', 12);
        });
      }
    }
  }

  it('uses req.system_user.system_user_id for Contributor authorization (not DB connection system user id)', async function () {
    registerMockDBConnection({
      systemUserId: () => 999
    });

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(false);

    const hasActiveContributorStub = sinon
      .stub(ContributorSystemUserService.prototype, 'hasActiveContributor')
      .resolves(true);

    const mockReq = {
      authorization_scheme: { and: [{ discriminator: 'Contributor' }] },
      keycloak_token: { sub: 'some-guid' },
      system_user: { system_user_id: 12 }
    } as unknown as Request;

    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
    expect(hasActiveContributorStub).to.have.been.calledOnceWith(12);
  });
});

describe('submission route membership revocation', () => {
  afterEach(() => sinon.restore());
  for (const [name, operation] of [
    ['history', history],
    ['deletion', deletion]
  ] as const) {
    for (const contributorMember of [false, true]) {
      for (const teamMember of [false, true]) {
        it(`${name}: contributor=${contributorMember}, team=${teamMember}`, async () => {
          registerMockDBConnection();
          sinon.stub(ContributorSystemUserService.prototype, 'hasActiveContributor').resolves(contributorMember);
          sinon
            .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipBySubmissionUuid')
            .resolves(teamMember ? { record_end_date: null, submission_id: 1 } : null);
          sinon
            .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipBySubmissionUpload')
            .resolves(teamMember ? { record_end_date: null, submission_upload_id: 'upload' } : null);
          const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
          mockReq.params = {
            submissionUuid: 'submission',
            submissionUploadId: 'submission-upload'
          };
          mockReq.keycloak_token = { sub: 'guid' };
          mockReq.system_user = { system_user_id: 12, role_names: [] } as unknown as SystemUserExtended;
          let failure: unknown;
          try {
            await (operation[0] as RequestHandler)(mockReq, mockRes, mockNext);
          } catch (error_) {
            failure = error_;
          }
          if (contributorMember && teamMember) {
            expect(failure).to.be.undefined;
            expect(mockNext).to.have.been.calledOnce;
          } else {
            expect(failure).to.be.instanceOf(HTTPError);
            expect((failure as HTTPError).status).to.equal(403);
            expect(mockNext).not.to.have.been.called;
          }
        });
      }
    }
  }
});
