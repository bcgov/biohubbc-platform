import chai, { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../src/errors/api-error';
import { ContributorMemberRepository } from '../../src/repositories/contributor-member-repository';
import { getMockDBConnection } from '../../src/__mocks__/db';

chai.use(sinonChai);

describe('ContributorMemberRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findContributorMember', () => {
    it('returns contributor-member relationship when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ contributor_system_user_id: 1, contributor_id: 123, system_user_id: 456 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorMemberRepository(mockDBConnection);

      const result = await repository.findContributorMember(123, 456);

      expect(result).to.eql({ contributor_system_user_id: 1, contributor_id: 123, system_user_id: 456 });
    });

    it('returns null when relationship does not exist', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorMemberRepository(mockDBConnection);

      const result = await repository.findContributorMember(123, 456);

      expect(result).to.equal(null);
    });

    it('throws ApiExecuteSQLError when duplicate rows are returned', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [
          { contributor_system_user_id: 1, contributor_id: 123, system_user_id: 456 },
          { contributor_system_user_id: 2, contributor_id: 123, system_user_id: 456 }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorMemberRepository(mockDBConnection);

      try {
        await repository.findContributorMember(123, 456);
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Unexpected row count');
      }
    });
  });

  describe('createContributorMember', () => {
    it('calls SQL insert with correct table and columns', async () => {
      const sqlSpy = sinon.stub().resolves({ rowCount: 1 });

      const mockDBConnection = getMockDBConnection({
        sql: sqlSpy
      });

      const repository = new ContributorMemberRepository(mockDBConnection);

      await repository.createContributorMember(123, 456);

      expect(sqlSpy).to.have.been.calledOnce;
      const insertQueryText = sqlSpy.getCall(0).args[0].text;
      expect(insertQueryText).to.contain('INSERT INTO contributor_system_user');
      expect(insertQueryText).to.contain('(contributor_id, system_user_id)');
    });

    it('throws error if insert fails (e.g., FK constraint)', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          throw new Error('insert or update on table "contributor_system_user" violates foreign key constraint');
        }
      });

      const repository = new ContributorMemberRepository(mockDBConnection);

      try {
        await repository.createContributorMember(999, 999);
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.contain('violates foreign key constraint');
      }
    });
  });
});
