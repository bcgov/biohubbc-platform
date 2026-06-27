import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { SubmissionTeam } from '../models/submission-team';
import { SubmissionTeamRepository } from './submission-team-repository';

chai.use(sinonChai);

describe('SubmissionTeamRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockSubmissionTeam: SubmissionTeam = {
    submission_team_id: 1,
    submission_id: 10,
    team_id: '11111111-1111-1111-1111-111111111111'
  };

  describe('insertSubmissionTeam', () => {
    it('inserts the link and returns the created record', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([mockSubmissionTeam]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SubmissionTeamRepository(mockDBConnection);
      const result = await repository.insertSubmissionTeam({
        submission_id: 10,
        team_id: '11111111-1111-1111-1111-111111111111'
      });

      expect(result).to.eql(mockSubmissionTeam);
      // Idempotent insert guard.
      expect(sqlStub.firstCall.args[0].text).to.contain('WHERE NOT EXISTS');
      expect(sqlStub.firstCall.args[0].text).to.contain('INSERT INTO submission_team');
      // Parses with the SubmissionTeam zod schema.
      expect(sqlStub).to.have.been.calledWithMatch(sinon.match.any, SubmissionTeam);
    });

    it('returns null when an active link already exists (rowCount 0)', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SubmissionTeamRepository(mockDBConnection);
      const result = await repository.insertSubmissionTeam({
        submission_id: 10,
        team_id: '11111111-1111-1111-1111-111111111111'
      });

      expect(result).to.be.null;
    });

    it('throws when the insert returns an unexpected row count', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([mockSubmissionTeam, mockSubmissionTeam], 2));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SubmissionTeamRepository(mockDBConnection);

      try {
        await repository.insertSubmissionTeam({
          submission_id: 10,
          team_id: '11111111-1111-1111-1111-111111111111'
        });
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Failed to insert submission team');
      }
    });
  });
});
