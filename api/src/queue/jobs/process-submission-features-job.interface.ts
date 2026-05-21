export type ProcessSubmissionFeatureSuccess = {
  status: 'ok';
  validationPayload: Record<string, unknown>;
};

export type ProcessSubmissionFeatureError = {
  status: 'invalid';
  validationPayload: Record<string, unknown>;
  errorCount: number;
};

export type ProcessSubmissionFeatureOutcome = ProcessSubmissionFeatureSuccess | ProcessSubmissionFeatureError;
