export type ProcessSubmissionFeaturesExecutionOutcome =
  | { status: 'ok'; validationPayload?: Record<string, unknown> }
  | {
      status: 'invalid';
      validationPayload: Record<string, unknown>;
      errorCount: number;
    };
