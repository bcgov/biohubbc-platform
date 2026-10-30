import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { FormTeamRepository } from './form-team-repository';

chai.use(sinonChai);

describe('FormTeamRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('reads the active teams linked to a form', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([{ team_id: 'team-1', name: 'Field crew' }]));
    const repository = new FormTeamRepository(getMockDBConnection({ knex: knexStub }));

    const result = await repository.getFormTeams(1);

    const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(result).to.eql([{ team_id: 'team-1', name: 'Field crew' }]);
    expect(sql).to.include('"ft"."record_end_date" is null');
    expect(sql).to.include('"t"."record_end_date" is null');
  });

  it('ends only the links of one form that are not retained', async () => {
    const sqlStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormTeamRepository(getMockDBConnection({ sql: sqlStub }));

    await repository.deleteFormTeamsNotIn(1, ['team-1']);

    const { text, values } = sqlStub.firstCall.args[0];
    expect(text).to.include('WHERE form_id =');
    expect(text).to.include('NOT (team_id = ANY(');
    expect(values).to.eql([1, ['team-1']]);
  });

  it('links teams in one statement without duplicating active links', async () => {
    const sqlStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormTeamRepository(getMockDBConnection({ sql: sqlStub }));

    await repository.insertFormTeams(1, ['team-1', 'team-2']);

    const { text, values } = sqlStub.firstCall.args[0];
    expect(text).to.include('ON CONFLICT (form_id, team_id) WHERE record_end_date IS NULL DO NOTHING');
    expect(values).to.eql([1, ['team-1', 'team-2']]);
  });

  it('links nothing for no teams', async () => {
    const sqlStub = sinon.stub();
    const repository = new FormTeamRepository(getMockDBConnection({ sql: sqlStub }));

    await repository.insertFormTeams(1, []);

    expect(sqlStub).not.to.have.been.called;
  });

  it('authorizes an active member of an active linked team', async () => {
    const sqlStub = sinon.stub().resolves(mockQueryResult([{ authorized: true }]));
    const repository = new FormTeamRepository(getMockDBConnection({ sql: sqlStub }));

    expect(await repository.isUserAuthorizedForForm(1, 9)).to.be.true;

    const { text, values } = sqlStub.firstCall.args[0];
    expect(text).to.include('tm.record_end_date IS NULL');
    expect(values).to.eql([1, 9]);
  });

  it('denies when the query returns no row', async () => {
    const sqlStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormTeamRepository(getMockDBConnection({ sql: sqlStub }));

    expect(await repository.isUserAuthorizedForForm(1, 9)).to.be.false;
  });
});
