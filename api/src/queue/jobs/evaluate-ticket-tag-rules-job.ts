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
 * Evaluate the enabled tag rules for each ticket and add the tags of the rules that match.
 *
 * Evaluation is idempotent: rules only add tags a ticket has never had, so a retried or repeated job leaves the same
 * tags. The jobs in a batch run concurrently, each ticket on its own connection and transaction.
 *
 * @param {PgBoss.Job<IEvaluateTicketTagRulesJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const evaluateTicketTagRulesJobHandler: PgBoss.WorkHandler<IEvaluateTicketTagRulesJobData> = async (jobs) => {
  await Promise.all(
    jobs.map(async (job) => {
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
    })
  );
};

/**
 * Dead Letter Queue handler for failed evaluate-ticket-tag-rules jobs.
 *
 * Log-only by design: re-throwing would loop the dead job forever. The ticket is evaluated again the next time its
 * upload is indexed (for example after a reindex) or a data request is linked to it.
 *
 * @param {PgBoss.Job<IEvaluateTicketTagRulesJobData>[]} jobs The failed jobs (post-retry)
 * @return {*}  {Promise<void>}
 */
export const evaluateTicketTagRulesFailedHandler: PgBoss.WorkHandler<IEvaluateTicketTagRulesJobData> = (jobs) => {
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

  return Promise.resolve();
};
