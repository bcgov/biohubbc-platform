import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { ContributorCodesetCode } from '../models/contributor-codeset-code';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ContributorCodesetCodeRepository } from './contributor-codeset-code-repository';

describe('ContributorCodesetCodeRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: ContributorCodesetCode = {
    contributor_codeset_code_id: 1,
    contributor_codeset_id: 2,
    key: 'adult',
    label: 'Adult',
    description: 'Adult life stage',
    version: 'v1'
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.insertContributorCodesetCode({
        contributor_codeset_id: 2,
        key: 'adult',
        label: 'Adult',
        description: 'Adult life stage',
        version: 'v1'
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.insertContributorCodesetCode({
          contributor_codeset_id: 2,
          key: 'adult',
          label: 'Adult',
          version: 'v1'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });

    it('inserts multiple rows', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({
          knex: () =>
            Promise.resolve(mockQueryResult([mockRow, { ...mockRow, contributor_codeset_code_id: 2, version: 'v2' }]))
        })
      );

      const result = await repository.insertContributorCodesetCodes([
        {
          contributor_codeset_id: 2,
          key: 'adult',
          label: 'Adult',
          description: 'Adult life stage',
          version: 'v1'
        },
        {
          contributor_codeset_id: 2,
          key: 'adult',
          label: 'Adult',
          description: 'Adult life stage',
          version: 'v2'
        }
      ]);

      expect(result).to.eql([mockRow, { ...mockRow, contributor_codeset_code_id: 2, version: 'v2' }]);
    });

    it('throws on failed multi-insert row count mismatch', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 1)) })
      );

      try {
        await repository.insertContributorCodesetCodes([
          {
            contributor_codeset_id: 2,
            key: 'adult',
            label: 'Adult',
            description: 'Adult life stage',
            version: 'v1'
          },
          {
            contributor_codeset_id: 2,
            key: 'adult',
            label: 'Adult',
            description: 'Adult life stage',
            version: 'v2'
          }
        ]);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('getById', () => {
    it('returns row', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getContributorCodesetCodeById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.getContributorCodesetCodeById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) })
      );

      try {
        await repository.getContributorCodesetCodeById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by contributor_codeset_id', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getContributorCodesetCodesByContributorCodesetId(2);
      expect(result).to.eql([mockRow]);
    });

    it('gets by identity when row exists', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.findContributorCodesetCodeByIdentity({
        contributor_codeset_id: 2,
        key: 'adult',
        version: 'v1'
      });
      expect(result).to.eql(mockRow);
    });

    it('returns null by identity when row does not exist', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      const result = await repository.findContributorCodesetCodeByIdentity({
        contributor_codeset_id: 2,
        key: 'adult',
        version: 'v1'
      });
      expect(result).to.equal(null);
    });

    it('throws by identity on unexpected row count', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) })
      );

      try {
        await repository.findContributorCodesetCodeByIdentity({
          contributor_codeset_id: 2,
          key: 'adult',
          version: 'v1'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });

    it('gets by identities', async () => {
      const repository = new ContributorCodesetCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getContributorCodesetCodesByIdentities([
        { contributor_codeset_id: 2, key: 'adult', version: 'v1' }
      ]);
      expect(result).to.eql([mockRow]);
    });

    it('returns empty when get by identities receives empty payload', async () => {
      const knexSpy = sinon.spy(() => Promise.resolve(mockQueryResult([mockRow])));
      const repository = new ContributorCodesetCodeRepository(getMockDBConnection({ knex: knexSpy }));

      const result = await repository.getContributorCodesetCodesByIdentities([]);
      expect(result).to.eql([]);
      expect(knexSpy).to.not.have.been.called;
    });
  });
});
