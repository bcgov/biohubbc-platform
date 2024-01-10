import { GridRowSelectionModel } from "@mui/x-data-grid";
import { ISecurityRuleAndCategory } from "hooks/api/useSecurityApi";

export interface ISecureDataAccessRequestForm {
  fullName: string;
  emailAddress: string;
  phoneNumber: string;
  reasonDescription: string;
  hasSignedAgreement: boolean;
  artifactIds: number[];
  pathToParent: string;
  companyInformation: {
    companyName: string;
    jobTitle: string;
    streetAddress: string;
    city: string;
    postalCode: string;
  };
  professionalOrganization: {
    organizationName?: string;
    memberNumber?: string;
  };
}

export type IListPersecutionHarmResponse = IPersecutionHarmRule[];

export interface IPersecutionHarmRule {
  persecution_or_harm_id: number;
  persecution_or_harm_type_id: number;
  wldtaxonomic_units_id: number;
  name: string;
  description: string | null;
}


/**
 * Represents a patch request made to apply security;
 *
 * @export
 * @interface IPatchFeatureSecurityRules
 */
export interface IPatchFeatureSecurityRules {
  /**
   * The array of submission feature IDs whose security rules will be mutated
   *
   * @type {number[]}
   * @memberof IPatchFeatureSecurityRules
   */
  submissionFeatureIds: number[] | GridRowSelectionModel
  /**
   * The array of the security rules that will be applied to all of the given features.
   * Note that it is possible that a particular rule ID may also belong to `stagedForRemove`.
   *
   * @type {number[]}
   * @memberof IPatchFeatureSecurityRules
   */
  stagedForApply: ISecurityRuleAndCategory[];
  /**
   * The array of the security rules that will be removed from all of the given features.
   * Note that it is possible that a particular rule ID may also belong to `stagedForApply`.
   *
   * @type {number[]}
   * @memberof IPatchFeatureSecurityRules
   */
  stagedForRemove: ISecurityRuleAndCategory[];
}
