export interface ICreateSubmissionForm {
  clientId: string;
  name: string;
  description: string;
  comment: string;
  file: File; // raw .tar submission archive
}
