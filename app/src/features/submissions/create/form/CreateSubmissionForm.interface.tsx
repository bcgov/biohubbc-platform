export interface ICreateSubmissionForm {
  name: string;
  description: string | null;
  file: File; // raw .json file of features
}
