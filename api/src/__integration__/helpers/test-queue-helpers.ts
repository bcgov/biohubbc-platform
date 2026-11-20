import { Knex } from 'knex';

/**
 * Remove the feature-pipeline jobs queued for the given submission uploads and their tickets,
 * waiting for any job a worker is running to finish first.
 *
 * Each pipeline stage publishes the next one when it completes, and the compose queue worker runs
 * them alongside the suite. Stages are keyed by the submission upload, except ticket tag-rule
 * evaluation, which is keyed by the ticket. Run this in a suite's committed cleanup before it
 * deletes those rows, so no stage is left queued against rows that no longer exist. Jobs that have
 * not started (`created`, `retry`) are deleted; a running (`active`) job is waited on, and whatever
 * it published is deleted on the next pass.
 *
 * @param {Knex} db Auto-committing Knex instance.
 * @param {{ submissionUploadIds: string[]; ticketIds: string[] }} scope Uploads and tickets whose jobs to remove.
 * @param {number} [timeoutMs=30000] How long to wait for running jobs to finish.
 * @return {Promise<void>}
 * @throws {Error} If a job in scope is still pending or running when the timeout elapses.
 */
export async function removePipelineJobs(
  db: Knex,
  scope: { submissionUploadIds: string[]; ticketIds: string[] },
  timeoutMs = 30000
): Promise<void> {
  const { submissionUploadIds, ticketIds } = scope;
  if (submissionUploadIds.length === 0 && ticketIds.length === 0) {
    return;
  }

  // The process stage names its keys in snake case; every later stage uses camel case.
  const inScope = (query: Knex.QueryBuilder) =>
    query
      .whereRaw(`data->>'submission_upload_id' = ANY(?::text[])`, [submissionUploadIds])
      .orWhereRaw(`data->>'submissionUploadId' = ANY(?::text[])`, [submissionUploadIds])
      .orWhereRaw(`data->>'ticketId' = ANY(?::text[])`, [ticketIds]);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await db('pgboss.job')
      .whereIn('state', ['created', 'retry'])
      .where((query) => inScope(query))
      .del();

    // Count every non-terminal state, not only `active`: a job that finished after the delete
    // above has already published its successor as `created`.
    const remaining = await db('pgboss.job')
      .whereIn('state', ['created', 'retry', 'active'])
      .where((query) => inScope(query))
      .count<{ count: string }[]>('id');
    if (Number(remaining[0].count) === 0) {
      return;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error('Timeout waiting for pipeline jobs of the test submission uploads to finish');
}
