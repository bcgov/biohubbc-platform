import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamFeatureRepository } from './team-feature-repository';

chai.use(sinonChai);

describe('TeamFeatureRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('deleteTeamFeaturesByTeamId', () => {
    it('calls knex delete for the given team id', async () => {
      const mockResponse = { rowCount: 3, rows: [] } as unknown as Promise<QueryResult<any>>;
      const knexStub = sinon.stub().resolves(mockResponse);
      const mockConnection = getMockDBConnection({ knex: knexStub });

      const repository = new TeamFeatureRepository(mockConnection);
      await repository.deleteTeamFeaturesByTeamId('22222222-2222-2222-2222-222222222222');

      expect(knexStub).to.have.been.calledOnce;
    });
  });

  describe('populateTeamFeatureCache', () => {
    it('calls sql to insert resolved features for the given team id', async () => {
      const mockResponse = { rowCount: 5, rows: [] } as unknown as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockResponse);
      const mockConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new TeamFeatureRepository(mockConnection);
      await repository.populateTeamFeatureCache('22222222-2222-2222-2222-222222222222');

      expect(sqlStub).to.have.been.calledOnce;
    });
  });
});
