import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('queue/jobs/example-job');

/**
 * Example job data interface.
 * Define the expected shape of data passed to this job.
 */
export interface IExampleJobData {
  message: string;
}

/**
 * Example job handler.
 *
 * This is a template demonstrating the pattern for pg-boss job handlers.
 * Replace with actual job logic as needed.
 *
 * Note: pg-boss v10 passes an array of jobs to handlers.
 *
 * @param {PgBoss.Job<IExampleJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const exampleJobHandler: PgBoss.WorkHandler<IExampleJobData> = async (jobs) => {
  for (const job of jobs) {
    const { message } = job.data;

    defaultLog.info({
      label: 'exampleJobHandler',
      message: 'Processing job',
      jobId: job.id,
      data: { message }
    });

    // Create database connection for job processing
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      // TODO: Add actual job processing logic here
      // Example:
      // const service = new SomeService(connection);
      // await service.doSomething(message);

      await connection.commit();

      defaultLog.info({
        label: 'exampleJobHandler',
        message: 'Job completed successfully',
        jobId: job.id
      });
    } catch (error) {
      await connection.rollback();
      defaultLog.error({
        label: 'exampleJobHandler',
        message: 'Job failed',
        jobId: job.id,
        error
      });
      throw error; // pg-boss will handle retry based on configuration
    } finally {
      connection.release();
    }
  }
};
