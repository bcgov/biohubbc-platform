import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import { ContributorService } from './contributor-service';
import { ContributorSystemUserService } from './contributor-system-user-service';

const contributor = {
  contributor_id: 1,
  client_id: 'client',
  description: null,
  record_end_date: null
};
const relationship = {
  contributor_system_user_id: 3,
  contributor_id: 1,
  system_user_id: 2,
  client_id: 'client',
  user_identifier: 'user',
  display_name: null,
  record_end_date: null
};

describe('Contributor administration services', () => {
  afterEach(() => sinon.restore());

  it('normalizes client IDs and preserves a nullable description', async () => {
    const contributorService = new ContributorService(getMockDBConnection());
    sinon.stub(contributorService.contributorRepository, 'findContributorByClientId').resolves(null);
    const insert = sinon.stub(contributorService.contributorRepository, 'insertAdministrativeContributor').resolves(1);
    sinon.stub(contributorService.contributorRepository, 'getAdministrativeContributor').resolves(contributor);
    expect(
      await contributorService.insertAdministrativeContributor({ clientId: ' client ', description: null })
    ).to.eql(contributor);
    expect(insert.firstCall.args).to.eql([{ clientId: 'client', description: null }]);
  });

  for (const input of [
    { clientId: ' ', description: null },
    { clientId: 'x'.repeat(101), description: null },
    { clientId: 'client', description: 'x'.repeat(1001) }
  ]) {
    it('rejects invalid contributor field lengths or blank client IDs', async () => {
      const contributorService = new ContributorService(getMockDBConnection());
      try {
        await contributorService.insertAdministrativeContributor(input);
        expect.fail('Expected validation error');
      } catch (error) {
        expect(error).instanceOf(ApiValidationError);
      }
    });
  }

  it('rejects duplicate active client IDs', async () => {
    const contributorService = new ContributorService(getMockDBConnection());
    sinon.stub(contributorService.contributorRepository, 'findContributorByClientId').resolves(contributor);
    try {
      await contributorService.insertAdministrativeContributor({ clientId: 'client', description: null });
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiConflictError);
    }
  });

  it('rejects edits of ended contributors and missing contributors', async () => {
    const contributorService = new ContributorService(getMockDBConnection());
    const get = sinon.stub(contributorService.contributorRepository, 'getAdministrativeContributor');
    get.onFirstCall().resolves({ ...contributor, record_end_date: '2026-01-01' });
    get.onSecondCall().resolves(undefined);
    try {
      await contributorService.updateAdministrativeContributor(1, { clientId: 'client', description: null });
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiConflictError);
    }
    try {
      await contributorService.getAdministrativeContributor(99);
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiNotFoundError);
    }
  });

  it('locks the contributor before ending relationships and propagates failure without ending its parent', async () => {
    const contributorService = new ContributorService(getMockDBConnection());
    const lock = sinon
      .stub(contributorService.contributorRepository, 'getAdministrativeContributor')
      .resolves(contributor);
    const endLinks = sinon
      .stub(contributorService.contributorSystemUserService, 'deleteContributorSystemUsers')
      .rejects(new Error('failure'));
    const endParent = sinon
      .stub(contributorService.contributorRepository, 'deleteAdministrativeContributor')
      .resolves();
    try {
      await contributorService.deleteAdministrativeContributor(1);
      expect.fail();
    } catch (error) {
      expect((error as Error).message).equals('failure');
    }
    expect(lock.calledBefore(endLinks)).is.true;
    expect(endParent.called).is.false;
  });

  it('deleting a missing contributor succeeds without touching relationships', async () => {
    const contributorService = new ContributorService(getMockDBConnection());
    sinon.stub(contributorService.contributorRepository, 'getAdministrativeContributor').resolves(undefined);
    const end = sinon.stub(contributorService.contributorSystemUserService, 'deleteContributorSystemUsers');
    await contributorService.deleteAdministrativeContributor(999);
    expect(end.called).is.false;
  });

  it('returns an empty page with its actual total', async () => {
    const contributorService = new ContributorService(getMockDBConnection());
    sinon.stub(contributorService.contributorRepository, 'listAdministrativeContributors').resolves([]);
    sinon.stub(contributorService.contributorRepository, 'countAdministrativeContributors').resolves(0);
    const result = await contributorService.listAdministrativeContributors(
      { keyword: 'missing' },
      { page: 1, limit: 10 }
    );
    expect(result.contributors).eql([]);
    expect(result.pagination.total).equals(0);
  });

  it('rejects ended contributors before attempting a relationship insert', async () => {
    const contributorSystemUserService = new ContributorSystemUserService(getMockDBConnection());
    sinon
      .stub(contributorSystemUserService.contributorRepository, 'getAdministrativeContributor')
      .resolves({ ...contributor, record_end_date: '2026-01-01' });
    try {
      await contributorSystemUserService.insertAdministrativeContributorSystemUser({
        contributorId: 1,
        systemUserId: 2
      });
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiValidationError);
    }
  });

  it('rejects blocked or absent system users', async () => {
    const contributorSystemUserService = new ContributorSystemUserService(getMockDBConnection());
    sinon
      .stub(contributorSystemUserService.contributorRepository, 'getAdministrativeContributor')
      .resolves(contributor);
    sinon.stub(contributorSystemUserService.contributorSystemUserRepository, 'lockActiveSystemUser').resolves(false);
    try {
      await contributorSystemUserService.insertAdministrativeContributorSystemUser({
        contributorId: 1,
        systemUserId: 2
      });
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiValidationError);
    }
  });

  it('rejects a user already assigned to a different relationship', async () => {
    const contributorSystemUserService = new ContributorSystemUserService(getMockDBConnection());
    sinon
      .stub(contributorSystemUserService.contributorRepository, 'getAdministrativeContributor')
      .resolves(contributor);
    sinon.stub(contributorSystemUserService.contributorSystemUserRepository, 'lockActiveSystemUser').resolves(true);
    sinon
      .stub(contributorSystemUserService.contributorSystemUserRepository, 'findContributorSystemUser')
      .resolves(relationship);
    try {
      await contributorSystemUserService.insertAdministrativeContributorSystemUser({
        contributorId: 1,
        systemUserId: 2
      });
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiConflictError);
    }
  });
});
