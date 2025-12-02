import { Job } from 'bullmq';
import { ISubmissionJobQueueRecord } from '../repositories/submission-job-queue-repository';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('bullmq/job-handlers');

export type SubmissionJobPayload = ISubmissionJobQueueRecord & { jobType?: string };

type JobHandler = (job: Job<SubmissionJobPayload>) => Promise<void>;

const placeholderHandler: JobHandler = async (job) => {
  defaultLog.info({
    label: 'placeholderHandler',
    message: 'processing placeholder job',
    submission_job_queue_id: job.data.submission_job_queue_id,
    submission_id: job.data.submission_id,
    jobType: job.data.jobType || 'submission-job'
  });

  // Simulate unit of work; replace with real workload (eg malware scan, validation, packaging, etc).
  await new Promise((resolve) => setTimeout(resolve, 100));
};

const handlers: Record<string, JobHandler> = {
  'submission-job': placeholderHandler
};

export const getJobHandler = (jobType?: string): JobHandler => {
  if (jobType && handlers[jobType]) {
    return handlers[jobType];
  }

  return handlers['submission-job'];
};
