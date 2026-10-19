import PgBoss from 'pg-boss';
import { TagRuleEvaluationService } from '../../services/tag-rule-evaluation-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/evaluate-ticket-tag-rules-job');

/**
 * Evaluate ticket tag rules job data interface.
 */
export interface IEvaluateTicketTagRulesJobData {
  /** The ticket whose tag rules are evaluated */
  ticketId: string;
}

/**
 * Evaluate the enabled tag rules for each ticket and apply or remove the rule-owned tags.
 *
 * Evaluation is idempotent: it computes the tags the rules want and applies only the difference, so a retried or
 * repeated job converges on the same tags. Each ticket runs in its own transaction.
 *
 * @param {PgBoss.Job<IEvaluateTicketTagRulesJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const evaluateTicketTagRulesJobHandler: PgBoss.WorkHandler<IEvaluateTicketTagRulesJobData> = async (jobs) => {
  for (const job of jobs) {
    const { ticketId } = job.data;

    defaultLog.info({
      label: 'evaluateTicketTagRulesJobHandler',
      message: 'Evaluating ticket tag rules',
      jobId: job.id,
      ticketId
    });

    try {
      await withConnection((connection) => new TagRuleEvaluationService(connection).evaluateTicketTagRules(ticketId));
    } catch (error) {
      defaultLog.error({
        label: 'evaluateTicketTagRulesJobHandler',
        message: 'Evaluate ticket tag rules job failed',
        jobId: job.id,
        ticketId,
        error
      });

      throw error; // pg-boss retries per queue config; terminal failure lands in DLQ
    }
  }
};

/**
 * Dead Letter Queue handler for failed evaluate-ticket-tag-rules jobs.
 *
 * Log-only by design: re-throwing would loop the dead job forever, and the next change to the ticket's associated
 * data queues a fresh evaluation.
 *
 * @param {PgBoss.Job<IEvaluateTicketTagRulesJobData>[]} jobs The failed jobs (post-retry)
 * @return {*}  {Promise<void>}
 */
export const evaluateTicketTagRulesFailedHandler: PgBoss.WorkHandler<IEvaluateTicketTagRulesJobData> = async (jobs) => {
  for (const job of jobs) {
    const jobOutput = (job as PgBoss.JobWithMetadata<IEvaluateTicketTagRulesJobData>).output;

    defaultLog.warn({
      label: 'evaluateTicketTagRulesFailedHandler',
      message: 'Evaluate ticket tag rules job failed after all retries',
      jobId: job.id,
      ticketId: job.data.ticketId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};
