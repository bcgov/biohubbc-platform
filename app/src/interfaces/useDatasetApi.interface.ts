export interface IArtifact {
  artifact_id: number;
  create_date: string;
  create_user: number;
  description: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  foi_reason: boolean | null;
  key: string;
  revision_count: number;
  security_review_timestamp: string | null;
  submission_id: number;
  title: string | null;
  update_date: string | null;
  update_user: number | null;
  uuid: string;
  supplementaryData: {
    persecutionAndHarmStatus: SECURITY_APPLIED_STATUS;
    persecutionAndHarmRules: IPersecutionAndHarmRule[];
  };
}

export enum SECURITY_APPLIED_STATUS {
  SECURED = 'SECURED',
  UNSECURED = 'UNSECURED',
  PARTIALLY_SECURED = 'PARTIALLY_SECURED',
  PENDING = 'PENDING'
}

export interface IPersecutionAndHarmRule {
  artifact_id: number;
  artifact_persecution_id: number;
  persecution_or_harm_id: number;
}

export interface IRelatedDataset {
  datasetId: string;
  title: string;
  url: string;
  supplementaryData: {
    isPendingReview: boolean;
  };
}

export interface IListRelatedDatasetsResponse {
  datasetsWithSupplementaryData: IRelatedDataset[];
}

export interface IHandlebarsTemplates {
  header: string;
  details: string;
}
export interface IDatasetForReview {
  dataset_id: string; // UUID
  artifacts_to_review: number;
  dataset_name: string;
  last_updated: string;
  keywords: string[];
}

export type SubmissionRecord = {
  submission_id: number;
  uuid: string;
  security_review_timestamp: string | null;
  source_system: string;
  name: string;
  description: string;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
};

export interface ISubmission {
  submission_id: number;
  uuid: string;
  security_review_timestamp: string;
}

export interface IFeature {
  submission_feature_id: number;
  submission_id: number;
  feature_type: string;
  data: any;
  parent_submission_feature_id: number | null;
}

export interface IGetSubmissionResponse {
  submission: ISubmission;
  features: {
    dataset: IFeature[];
    sampleSites: IFeature[];
    animals: IFeature[];
    observations: IFeature[];
  };
}
