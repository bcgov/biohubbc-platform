import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { ContributorCodeset } from '../models/contributor-codeset';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ContributorCodesetRepository } from './contributor-codeset-repository';

describe('ContributorCodesetRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: ContributorCodeset = {
    contributor_codeset_id: 1,
    contributor_id: 10,
    key: 'life_stage',
    label: 'Life stage',
    description: 'Life stage codes',
    version: 'v1'
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.insertContributorCodeset({
        contributor_id: 10,
        key: 'life_stage',
        label: 'Life stage',
        description: 'Life stage codes',
        version: 'v1'
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.insertContributorCodeset({
          contributor_id: 10,
          key: 'life_stage',
          label: 'Life stage',
          version: 'v1'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });

    it('inserts multiple rows', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({
          knex: () =>
            Promise.resolve(mockQueryResult([mockRow, { ...mockRow, contributor_codeset_id: 2, version: 'v2' }]))
        })
      );

      const result = await repository.insertContributorCodesets([
        {
          contributor_id: 10,
          key: 'life_stage',
          label: 'Life stage',
          description: 'Life stage codes',
          version: 'v1'
        },
        {
          contributor_id: 10,
          key: 'life_stage',
          label: 'Life stage',
          description: 'Life stage codes',
          version: 'v2'
        }
      ]);

      expect(result).to.eql([mockRow, { ...mockRow, contributor_codeset_id: 2, version: 'v2' }]);
    });

    it('throws on failed multi-insert row count mismatch', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 1)) })
      );

      try {
        await repository.insertContributorCodesets([
          {
            contributor_id: 10,
            key: 'life_stage',
            label: 'Life stage',
            description: 'Life stage codes',
            version: 'v1'
          },
          {
            contributor_id: 10,
            key: 'life_stage',
            label: 'Life stage',
            description: 'Life stage codes',
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
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getContributorCodesetById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.getContributorCodesetById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) })
      );

      try {
        await repository.getContributorCodesetById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by contributor_id', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getContributorCodesetsByContributorId(10);
      expect(result).to.eql([mockRow]);
    });

    it('gets by identity when row exists', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.findContributorCodesetByIdentity(10, 'life_stage', 'v1');
      expect(result).to.eql(mockRow);
    });

    it('returns null by identity when row does not exist', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      const result = await repository.findContributorCodesetByIdentity(10, 'life_stage', 'v1');
      expect(result).to.equal(null);
    });

    it('throws by identity on unexpected row count', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) })
      );

      try {
        await repository.findContributorCodesetByIdentity(10, 'life_stage', 'v1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });

    it('gets by identities', async () => {
      const repository = new ContributorCodesetRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getContributorCodesetsByIdentities([
        { contributor_id: 10, key: 'life_stage', version: 'v1' }
      ]);
      expect(result).to.eql([mockRow]);
    });

    it('returns empty when get by identities receives empty payload', async () => {
      const knexSpy = sinon.spy(() => Promise.resolve(mockQueryResult([mockRow])));
      const repository = new ContributorCodesetRepository(getMockDBConnection({ knex: knexSpy }));

      const result = await repository.getContributorCodesetsByIdentities([]);
      expect(result).to.eql([]);
      expect(knexSpy).to.not.have.been.called;
    });
  });
});
