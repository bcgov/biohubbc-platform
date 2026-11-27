import { ApiPaginationResponseParams } from 'types/pagination';

/** Filters for the administrative form list. Keyword matches the name or slug. */
export interface IFormFilters {
  keyword?: string;
}

/** A form in the administrative list, with its latest version. */
export interface IFormListItem {
  form_id: number;
  slug: string;
  name: string;
  description: string | null;
  is_public: boolean;
  create_date: string;
  form_version_id: number | null;
  version_number: number | null;
  /** Null while the latest version is a draft. */
  record_effective_date: string | null;
}

export interface IFormsResponse {
  forms: IFormListItem[];
  pagination: ApiPaginationResponseParams;
}

/** Field of a form section being saved. A code field names a codeset of the form's contributor. */
export interface ISaveFormField {
  featurePropertyId: number;
  label: string;
  description: string | null;
  contributorCodesetId: number | null;
}

/** Section of a form version being saved. Field order is the array order. */
export interface ISaveFormSection {
  featureTypeId: number;
  label: string;
  description: string | null;
  requiredValue: boolean;
  allowMultiple: boolean;
  fields: ISaveFormField[];
}

/** The form metadata and complete layout of a draft version. Section order is the array order. */
export interface ISaveFormVersion {
  name: string;
  description: string | null;
  isPublic: boolean;
  sections: ISaveFormSection[];
}

/** A new form and the layout of its first version. The slug and contributor cannot change afterwards. */
export interface ICreateForm extends ISaveFormVersion {
  slug: string;
  contributorId: number;
}

export interface IFormField {
  blueprint_feature_type_property_id: number;
  blueprint_feature_type_id: number;
  feature_property_id: number;
  feature_property_name: string;
  feature_property_display_name: string;
  type_name: string;
  label: string;
  description: string | null;
  contributor_codeset_id: number | null;
  sort: number | null;
}

export interface IFormSection {
  blueprint_feature_type_id: number;
  feature_type_id: number;
  feature_type_name: string;
  feature_type_display_name: string;
  label: string;
  description: string | null;
  required_value: boolean;
  allow_multiple: boolean;
  sort: number | null;
  fields: IFormField[];
}

/** A form version and its complete layout. */
export interface IFormVersionLayout {
  form: {
    form_id: number;
    slug: string;
    contributor_id: number;
    /** The form administration team. */
    team_id: string;
    name: string;
    description: string | null;
    is_public: boolean;
    record_end_date: string | null;
  };
  form_version: {
    form_version_id: number;
    form_id: number;
    blueprint_id: number;
    version_number: number;
    /** Null while the version is a draft. */
    record_effective_date: string | null;
    /** Set once a newer version is published. */
    record_end_date: string | null;
  };
  sections: IFormSection[];
}

/** A team whose members may access a form that is not public. */
export interface IFormTeam {
  team_id: string;
  name: string;
}

export interface IFormTeamsResponse {
  teams: IFormTeam[];
}

/** Lifecycle of a form submission. Editing a submitted form submission returns it to draft. */
export type FormSubmissionStatus = 'draft' | 'submitted';

/** A value entered in one field of a form submission row. */
export type FormSubmissionValue = string | number | boolean | null;

/** One row of a form section: one feature, with values keyed by feature property identifier. */
export interface IFormSubmissionRowData {
  /** Stable across saves and revisions. */
  sourceId: string;
  values: Record<string, FormSubmissionValue>;
}

/** The draft document of a form submission. */
export interface IFormSubmissionData {
  sections: { featureTypeId: number; rows: IFormSubmissionRowData[] }[];
}

export interface IFormSubmission {
  form_submission_id: number;
  uuid: string;
  form_id: number;
  form_version_id: number;
  team_id: string;
  submission_id: number | null;
  status: FormSubmissionStatus;
  data: IFormSubmissionData;
  submitted_date: string | null;
  create_date: string;
  create_user: number;
}

/** The latest submit of a form submission. */
export interface IFormSubmissionLatestUpload {
  submission_upload_id: string;
  status: string;
  decision: 'pending' | 'approving' | 'approved' | 'denied';
  data: IFormSubmissionData;
  create_date: string;
}

/** A form submission with the caller's relationship to it and its latest submit. */
export interface IFormSubmissionDetail {
  form_submission: IFormSubmission;
  /** Whether the caller may edit and submit the form submission. */
  is_owner: boolean;
  /** Whether the caller may review the form's submissions. */
  is_form_admin: boolean;
  latest_upload: IFormSubmissionLatestUpload | null;
}

export interface IFormSubmissionListItem {
  form_submission_id: number;
  uuid: string;
  status: FormSubmissionStatus;
  submitted_date: string | null;
  create_date: string;
  submitted_by_identifier: string | null;
  submission_upload_id: string | null;
  upload_status: string | null;
  upload_decision: IFormSubmissionLatestUpload['decision'] | null;
}

export interface IFormSubmissionsResponse {
  form_submissions: IFormSubmissionListItem[];
  is_form_admin: boolean;
  pagination: ApiPaginationResponseParams;
}

/** Review decision a form administrator can request. */
export type FormSubmissionUploadDecision = 'pending' | 'approved' | 'denied';
