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
