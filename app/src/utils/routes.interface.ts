export type SubmissionFeaturePathResolver = (submissionId: number, submissionFeatureId: number) => string;

export type SubmissionTaxonPathResolver = (submissionId: number, taxonId: number) => string;

export type SubmissionCodePathResolver = (submissionId: number, codesetKey: string, codeKey: string) => string;

export interface SubmissionPropertyValuePathResolvers {
  getSubmissionTaxonPath: SubmissionTaxonPathResolver;
  getSubmissionCodePath: SubmissionCodePathResolver;
  getSubmissionFeaturePath: SubmissionFeaturePathResolver;
}
