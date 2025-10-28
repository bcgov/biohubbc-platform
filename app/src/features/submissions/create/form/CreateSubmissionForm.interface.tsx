export interface ICreateSubmissionForm {
  name: string;
  description: string;
  comment: string;
  uid: string;
  file: File; // raw .json file of features
}
