export type IListSubmissionsResponse = Array<{
  submission_id: number;
  submission_status: string;
  source_transform_id: string;
  uuid: string;
  event_timestamp: string;
  delete_timestamp: string | null;
  input_key: string | null;
  input_file_name: string | null;
  eml_source: string | null;
  darwin_core_source: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}>;
