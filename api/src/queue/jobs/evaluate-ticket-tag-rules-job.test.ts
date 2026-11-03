import { expect } from 'chai';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { TagRuleEvaluationService } from '../../services/tag-rule-evaluation-service';
import { evaluateTicketTagRulesJobHandler, IEvaluateTicketTagRulesJobData } from './evaluate-ticket-tag-rules-job';

describe('evaluate-ticket-tag-rules-job', () => {
  let connection: ReturnType<typeof getMockDBConnection>;

  beforeEach(() => {
    connection = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(connection);
  });

  afterEach(() => sinon.restore());

  describe('evaluateTicketTagRulesJobHandler', () => {
    const job = { id: 'job-1', data: { ticketId: 'ticket-1' } } as PgBoss.Job<IEvaluateTicketTagRulesJobData>;

    it('evaluates the ticket in a committed transaction', async () => {
      const evaluateStub = sinon.stub(TagRuleEvaluationService.prototype, 'evaluateTicketTagRules').resolves();

      await evaluateTicketTagRulesJobHandler([job]);

      expect(evaluateStub.calledOnceWith('ticket-1')).to.be.true;
      expect((connection.commit as sinon.SinonStub).calledOnce).to.be.true;
    });

    it('rolls back and rethrows so pg-boss retries', async () => {
      sinon.stub(TagRuleEvaluationService.prototype, 'evaluateTicketTagRules').rejects(new Error('boom'));

      try {
        await evaluateTicketTagRulesJobHandler([job]);
        expect.fail('Expected error');
      } catch (error) {
        expect((error as Error).message).to.equal('boom');
      }

      expect((connection.rollback as sinon.SinonStub).calledOnce).to.be.true;
    });
  });
});
