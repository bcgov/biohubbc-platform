import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ContributorSystemUserRepository } from '../repositories/contributor-system-user-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ContributorSystemUserService } from './contributor-system-user-service';

chai.use(sinonChai);

describe('ContributorSystemUserService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ensureContributorSystemUser', () => {
    it('creates contributor-system-user when relationship does not exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new ContributorSystemUserService(mockDBConnection);

      const findStub = sinon
        .stub(ContributorSystemUserRepository.prototype, 'findContributorSystemUser')
        .resolves(null);
      const createStub = sinon
        .stub(ContributorSystemUserRepository.prototype, 'createContributorSystemUser')
        .resolves();

      await service.ensureContributorSystemUser(123, 456);

      expect(findStub).to.have.been.calledOnceWith(456);
      expect(createStub).to.have.been.calledOnceWith(123, 456);
    });

    it('does not create contributor-system-user when relationship already exists', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new ContributorSystemUserService(mockDBConnection);

      const findStub = sinon.stub(ContributorSystemUserRepository.prototype, 'findContributorSystemUser').resolves({
        contributor_system_user_id: 1,
        contributor_id: 123,
        system_user_id: 456
      });
      const createStub = sinon
        .stub(ContributorSystemUserRepository.prototype, 'createContributorSystemUser')
        .resolves();

      await service.ensureContributorSystemUser(123, 456);

      expect(findStub).to.have.been.calledOnceWith(456);
      expect(createStub).to.not.have.been.called;
    });
  });
});
