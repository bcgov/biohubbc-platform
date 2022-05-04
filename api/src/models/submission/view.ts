export interface IInsertSubmissionRecord {
  source: string;
  uuid: string;
  event_timestamp: string;
  input_key: string;
  input_file_name: string;
  eml_source: string;
  darwin_core_source: string;
}

export interface ISubmissionRecord {
  submission_id: number;
  source: string;
  uuid: string;
  event_timestamp: string;
  delete_timestamp: string;
  input_key: string;
  input_file_name: string;
  eml_source: string;
  darwin_core_source: string;
  create_date: string;
  create_user: number;
  update_date: string;
  update_user: number;
  revision_count: number;
}

export class SubmissionObject implements ISubmissionRecord {
  submission_id: number;
  source: string;
  uuid: string;
  event_timestamp: string;
  delete_timestamp: string;
  input_key: string;
  input_file_name: string;
  eml_source: string;
  darwin_core_source: string;
  create_date: string;
  create_user: number;
  update_date: string;
  update_user: number;
  revision_count: number;

  constructor(obj?: any) {
    this.submission_id = obj?.submission_id || null;
    this.source = obj?.source || null;
    this.uuid = obj?.uuid || null;
    this.event_timestamp = obj?.event_timestamp || null;
    this.delete_timestamp = obj?.delete_timestamp || null;
    this.input_key = obj?.input_key || null;
    this.input_file_name = obj?.input_file_name || null;
    this.eml_source = obj?.eml_source || null;
    this.darwin_core_source = obj?.darwin_core_source || null;
    this.create_date = obj?.create_date || null;
    this.create_user = obj?.create_user || null;
    this.update_date = obj?.update_date || null;
    this.update_user = obj?.update_user || null;
    this.revision_count = obj?.revision_count || null;
  }
}
