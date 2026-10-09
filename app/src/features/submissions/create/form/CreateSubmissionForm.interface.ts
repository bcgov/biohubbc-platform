export interface ICreateSubmissionForm {
  clientId: string;
  name: string;
  description: string;
  comment: string;
  file: File; // raw .tar or .tar.gz submission archive
}
