import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { TicketCommentArtifactRepository } from './ticket-comment-artifact-repository';

chai.use(sinonChai);

describe('TicketCommentArtifactRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockTicketId = '11111111-1111-1111-1111-111111111111';
  const mockTicketCommentId = '33333333-3333-3333-3333-333333333333';

  describe('deleteTicketCommentArtifacts', () => {
    it('soft deletes active artifact references for a ticket comment', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const knexStub = sinon.stub().returns(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });
      const repo = new TicketCommentArtifactRepository(mockDBConnection);

      await repo.deleteTicketCommentArtifacts(mockTicketCommentId);

      expect(knexStub).to.have.been.calledOnce;
    });
  });

  describe('replaceTicketCommentArtifacts', () => {
    it('soft deletes existing artifact references before inserting valid active ticket artifacts', async () => {
      const deleteResponse = Promise.resolve(mockQueryResult([]));
      const insertResponse = Promise.resolve(mockQueryResult([]));
      const knexStub = sinon.stub().returns(deleteResponse);
      const sqlStub = sinon.stub().returns(insertResponse);
      const mockDBConnection = getMockDBConnection({ knex: knexStub, sql: sqlStub });
      const repo = new TicketCommentArtifactRepository(mockDBConnection);

      await repo.replaceTicketCommentArtifacts(mockTicketId, mockTicketCommentId, [
        '55555555-5555-4555-8555-555555555555'
      ]);

      expect(knexStub).to.have.been.calledOnce;
      expect(sqlStub).to.have.been.calledOnce;
    });

    it('only soft deletes existing artifact references when no parsed references exist', async () => {
      const deleteResponse = Promise.resolve(mockQueryResult([]));
      const knexStub = sinon.stub().returns(deleteResponse);
      const sqlStub = sinon.stub();
      const mockDBConnection = getMockDBConnection({ knex: knexStub, sql: sqlStub });
      const repo = new TicketCommentArtifactRepository(mockDBConnection);

      await repo.replaceTicketCommentArtifacts(mockTicketId, mockTicketCommentId, []);

      expect(knexStub).to.have.been.calledOnce;
      expect(sqlStub).not.to.have.been.called;
    });
  });
});
