import { SubmissionUpload } from '../models/submission-upload';
import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
import {
  computeScopeAnchorsFailedHandler,
  computeScopeAnchorsJobHandler,
  IComputeScopeAnchorsJobData
} from './jobs/compute-scope-anchors-job';
import {
  computeSubmissionFeatureClosureFailedHandler,
  computeSubmissionFeatureClosureJobHandler,
  IComputeSubmissionFeatureClosureJobData
} from './jobs/compute-submission-feature-closure-job';
import {
  IIndexSubmissionFeaturesJobData,
  indexSubmissionFeaturesFailedHandler,
  indexSubmissionFeaturesJobHandler
} from './jobs/index-submission-features-job';
import { IMalwareScanJobData, malwareScanFailedHandler, malwareScanJobHandler } from './jobs/malware-scan-job';
import {
  IPollDownloadSchedulesJobData,
  pollDownloadSchedulesFailedHandler,
  pollDownloadSchedulesJobHandler
} from './jobs/poll-download-schedules-job';
import {
  IProcessDownloadJobData,
  processDownloadFailedHandler,
  processDownloadJobHandler
} from './jobs/process-download-job';
import {
  processDownloadVersionExportFailedHandler,
  processDownloadVersionExportJobHandler
} from './jobs/process-download-version-export-job';
import {
  processSubmissionFeaturesFailedHandler,
  processSubmissionFeaturesJobHandler
} from './jobs/process-submission-features-job';
import {
  ISubmissionUploadSecurityJobData,
  submissionUploadSecurityFailedHandler,
  submissionUploadSecurityJobHandler
} from './jobs/submission-upload-security-job';
import { getPgBoss } from './pg-boss-service';
import { IProcessDownloadVersionExportJobData } from './publisher';

const defaultLog = getLogger('queue/worker');

/**
 * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
 *
 * Testing convention: worker registration tests should stub this bag instead of
 * stubbing imported job modules directly.
 */
export interface WorkerDependencies {
  getPgBoss: typeof getPgBoss;
  processSubmissionFeaturesJobHandler: typeof processSubmissionFeaturesJobHandler;
  processSubmissionFeaturesFailedHandler: typeof processSubmissionFeaturesFailedHandler;
  malwareScanJobHandler: typeof malwareScanJobHandler;
  malwareScanFailedHandler: typeof malwareScanFailedHandler;
  processDownloadJobHandler: typeof processDownloadJobHandler;
  processDownloadFailedHandler: typeof processDownloadFailedHandler;
  processDownloadVersionExportJobHandler: typeof processDownloadVersionExportJobHandler;
  processDownloadVersionExportFailedHandler: typeof processDownloadVersionExportFailedHandler;
  indexSubmissionFeaturesJobHandler: typeof indexSubmissionFeaturesJobHandler;
  indexSubmissionFeaturesFailedHandler: typeof indexSubmissionFeaturesFailedHandler;
  computeScopeAnchorsJobHandler: typeof computeScopeAnchorsJobHandler;
  computeScopeAnchorsFailedHandler: typeof computeScopeAnchorsFailedHandler;
  computeSubmissionFeatureClosureJobHandler: typeof computeSubmissionFeatureClosureJobHandler;
  computeSubmissionFeatureClosureFailedHandler: typeof computeSubmissionFeatureClosureFailedHandler;
  pollDownloadSchedulesJobHandler: typeof pollDownloadSchedulesJobHandler;
  pollDownloadSchedulesFailedHandler: typeof pollDownloadSchedulesFailedHandler;
  submissionUploadSecurityJobHandler: typeof submissionUploadSecurityJobHandler;
  submissionUploadSecurityFailedHandler: typeof submissionUploadSecurityFailedHandler;
}

export const workerDependencies: WorkerDependencies = {
  getPgBoss,
  processSubmissionFeaturesJobHandler,
  processSubmissionFeaturesFailedHandler,
  malwareScanJobHandler,
  malwareScanFailedHandler,
  processDownloadJobHandler,
  processDownloadFailedHandler,
  processDownloadVersionExportJobHandler,
  processDownloadVersionExportFailedHandler,
  indexSubmissionFeaturesJobHandler,
  indexSubmissionFeaturesFailedHandler,
  computeScopeAnchorsJobHandler,
  computeScopeAnchorsFailedHandler,
  computeSubmissionFeatureClosureJobHandler,
  computeSubmissionFeatureClosureFailedHandler,
  pollDownloadSchedulesJobHandler,
  pollDownloadSchedulesFailedHandler,
  submissionUploadSecurityJobHandler,
  submissionUploadSecurityFailedHandler
};

/**
 * Register all job handlers with pg-boss.
 *
 * Add new job handler registrations here as they are created.
 *
 * @return {*}  {Promise<void>}
 */
export const registerWorkers = async (): Promise<void> => {
  const boss = workerDependencies.getPgBoss();

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);

  // Create main queue with dead letter queue and retry configuration.
  // policy: 'short' — enforces singleton_key uniqueness for queued (created) jobs.
  // Without this, the default 'standard' policy ignores singletonKey entirely.
  await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES, {
    deadLetter: JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
    policy: 'short'
  });

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.MALWARE_SCAN_FAILED);

  await boss.createQueue(JobQueues.MALWARE_SCAN, {
    deadLetter: JobQueues.MALWARE_SCAN_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });

  // Register process submission features job handler
  await boss.work<SubmissionUpload>(
    JobQueues.PROCESS_SUBMISSION_FEATURES,
    workerDependencies.processSubmissionFeaturesJobHandler
  );

  // Register dead letter queue handler for failed jobs
  await boss.work<SubmissionUpload>(
    JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
    workerDependencies.processSubmissionFeaturesFailedHandler
  );

  // Register malware scan job handler
  await boss.work<IMalwareScanJobData>(JobQueues.MALWARE_SCAN, workerDependencies.malwareScanJobHandler);

  // Register dead letter queue handler for failed malware scan jobs
  await boss.work<IMalwareScanJobData>(JobQueues.MALWARE_SCAN_FAILED, workerDependencies.malwareScanFailedHandler);

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.PROCESS_DOWNLOAD_FAILED);

  // Create main queue with dead letter queue and retry configuration
  await boss.createQueue(JobQueues.PROCESS_DOWNLOAD, {
    deadLetter: JobQueues.PROCESS_DOWNLOAD_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });

  // Register process download job handler
  await boss.work<IProcessDownloadJobData>(JobQueues.PROCESS_DOWNLOAD, workerDependencies.processDownloadJobHandler);

  // Register dead letter queue handler for failed download jobs
  await boss.work<IProcessDownloadJobData>(
    JobQueues.PROCESS_DOWNLOAD_FAILED,
    workerDependencies.processDownloadFailedHandler
  );

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT_FAILED);

  // Create main queue with dead letter queue and retry configuration.
  // policy: 'short' — enforces singletonKey uniqueness for queued (created) jobs.
  // Without this, the default 'standard' policy ignores singletonKey entirely,
  // and two concurrent export requests for the same group would both run.
  await boss.createQueue(JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT, {
    deadLetter: JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    policy: 'short'
  });

  // Register dead letter queue handler for failed download version export jobs
  await boss.work<IProcessDownloadVersionExportJobData>(
    JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT_FAILED,
    workerDependencies.processDownloadVersionExportFailedHandler
  );

  // Register process download version export job handler
  await boss.work<IProcessDownloadVersionExportJobData>(
    JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT,
    workerDependencies.processDownloadVersionExportJobHandler
  );

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.INDEX_SUBMISSION_FEATURES_FAILED);

  // Create main queue with dead letter queue and retry configuration
  await boss.createQueue(JobQueues.INDEX_SUBMISSION_FEATURES, {
    deadLetter: JobQueues.INDEX_SUBMISSION_FEATURES_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });

  // Register index submission features job handler
  await boss.work<IIndexSubmissionFeaturesJobData>(
    JobQueues.INDEX_SUBMISSION_FEATURES,
    workerDependencies.indexSubmissionFeaturesJobHandler
  );

  // Register dead letter queue handler for failed index submission features jobs
  await boss.work<IIndexSubmissionFeaturesJobData>(
    JobQueues.INDEX_SUBMISSION_FEATURES_FAILED,
    workerDependencies.indexSubmissionFeaturesFailedHandler
  );

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED);

  // Create main queue with dead letter queue and retry configuration.
  // policy: 'short' enforces the per-scope singletonKey used by anchor jobs.
  await boss.createQueue(JobQueues.COMPUTE_SCOPE_ANCHORS, {
    deadLetter: JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    policy: 'short'
  });

  // Register compute scope anchors job handler
  await boss.work<IComputeScopeAnchorsJobData>(
    JobQueues.COMPUTE_SCOPE_ANCHORS,
    workerDependencies.computeScopeAnchorsJobHandler
  );

  // Register dead letter queue handler for failed compute scope anchors jobs
  await boss.work<IComputeScopeAnchorsJobData>(
    JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED,
    workerDependencies.computeScopeAnchorsFailedHandler
  );

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE_FAILED);

  // Create main queue with dead letter queue and retry configuration.
  // policy: 'short' — enforces singletonKey uniqueness for queued (created) jobs.
  // Without this, the default 'standard' policy ignores singletonKey entirely,
  // and two concurrent recomputes for the same upload would both run.
  await boss.createQueue(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE, {
    deadLetter: JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    policy: 'short'
  });

  // Register compute submission feature closure job handler
  await boss.work<IComputeSubmissionFeatureClosureJobData>(
    JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE,
    workerDependencies.computeSubmissionFeatureClosureJobHandler
  );

  // Register dead letter queue handler for failed compute submission feature closure jobs
  await boss.work<IComputeSubmissionFeatureClosureJobData>(
    JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE_FAILED,
    workerDependencies.computeSubmissionFeatureClosureFailedHandler
  );

  // Hourly UTC infrastructure tick. The per-download cadence is the schedule row's own
  // cron_expression; this fixed interval is just how often the worker scans for due schedules.
  const POLL_DOWNLOAD_SCHEDULES_CRON = '0 * * * *';

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.POLL_DOWNLOAD_SCHEDULES_FAILED);

  // Create main queue with dead letter queue and retry configuration. No policy:'short' — the tick
  // carries no singletonKey, so the default 'standard' policy is correct; the next interval re-scans
  // anything a missed tick left due.
  await boss.createQueue(JobQueues.POLL_DOWNLOAD_SCHEDULES, {
    deadLetter: JobQueues.POLL_DOWNLOAD_SCHEDULES_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });

  // Register poll download schedules job handler
  await boss.work<IPollDownloadSchedulesJobData>(
    JobQueues.POLL_DOWNLOAD_SCHEDULES,
    workerDependencies.pollDownloadSchedulesJobHandler
  );

  // Register dead letter queue handler for failed poll download schedules ticks
  await boss.work<IPollDownloadSchedulesJobData>(
    JobQueues.POLL_DOWNLOAD_SCHEDULES_FAILED,
    workerDependencies.pollDownloadSchedulesFailedHandler
  );

  // Schedule the recurring tick. The queue must already exist (created + worked above) before it can
  // be scheduled. tz UTC keeps the infra cadence stable across DST regardless of server timezone.
  await boss.schedule(JobQueues.POLL_DOWNLOAD_SCHEDULES, POLL_DOWNLOAD_SCHEDULES_CRON, {}, { tz: 'UTC' });

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.SUBMISSION_UPLOAD_SECURITY_FAILED);

  // Create main queue with dead letter queue and retry configuration.
  // policy: 'short' — enforces singletonKey uniqueness for queued jobs so two concurrent
  // screening runs for the same upload are not created.
  await boss.createQueue(JobQueues.SUBMISSION_UPLOAD_SECURITY, {
    deadLetter: JobQueues.SUBMISSION_UPLOAD_SECURITY_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    policy: 'short'
  });

  // Register submission upload security (automatic screening) job handler
  await boss.work<ISubmissionUploadSecurityJobData>(
    JobQueues.SUBMISSION_UPLOAD_SECURITY,
    workerDependencies.submissionUploadSecurityJobHandler
  );

  // Register dead letter queue handler for failed submission upload security jobs
  await boss.work<ISubmissionUploadSecurityJobData>(
    JobQueues.SUBMISSION_UPLOAD_SECURITY_FAILED,
    workerDependencies.submissionUploadSecurityFailedHandler
  );

  defaultLog.info({
    label: 'registerWorkers',
    message: 'Workers registered',
    queues: Object.values(JobQueues)
  });
};
