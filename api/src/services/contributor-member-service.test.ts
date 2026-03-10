import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ContributorMemberRepository } from '../repositories/contributor-member-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ContributorMemberService } from './contributor-member-service';

chai.use(sinonChai);

describe('ContributorMemberService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ensureContributorMember', () => {
    it('creates contributor-member when relationship does not exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new ContributorMemberService(mockDBConnection);

      const findStub = sinon.stub(ContributorMemberRepository.prototype, 'findContributorMember').resolves(null);
      const createStub = sinon.stub(ContributorMemberRepository.prototype, 'createContributorMember').resolves();

      await service.ensureContributorMember(123, 456);

      expect(findStub).to.have.been.calledOnceWith(123, 456);
      expect(createStub).to.have.been.calledOnceWith(123, 456);
    });

    it('does not create contributor-member when relationship already exists', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new ContributorMemberService(mockDBConnection);

      const findStub = sinon.stub(ContributorMemberRepository.prototype, 'findContributorMember').resolves({
        contributor_system_user_id: 1,
        contributor_id: 123,
        system_user_id: 456
      });
      const createStub = sinon.stub(ContributorMemberRepository.prototype, 'createContributorMember').resolves();

      await service.ensureContributorMember(123, 456);

      expect(findStub).to.have.been.calledOnceWith(123, 456);
      expect(createStub).to.not.have.been.called;
    });
  });
});
