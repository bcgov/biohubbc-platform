import { IngestionErrorCount, IngestionErrorSample } from '../../models/submission-feature-property-ingestion';

/**
 * Deep-validation/indexing outcome for submission feature property ingestion.
 */
export type SubmissionFeaturePropertyValidationOutcome =
  | { status: 'ok' }
  | {
      status: 'invalid';
      errorCount: number;
      errorCounts: IngestionErrorCount[];
      errorSamples: IngestionErrorSample[];
    };
