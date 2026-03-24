export interface ICreateSubmissionForm {
  name: string;
  description: string;
  comment: string;
  file: File; // raw .tar submission archive
}
