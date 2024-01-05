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
  submissionFeatureIds: number[];
  /**
   * The array of the security rule IDs that will be applied to all of the given features.
   * Note that it is possible that a particular rule ID may also belong to `removeRuleIds`.
   *
   * @type {number[]}
   * @memberof IPatchFeatureSecurityRules
   */
  applyRuleIds: number[];
  /**
   * The array of the security rule IDs that will be removed from all of the given features.
   * Note that it is possible that a particular rule ID may also belong to `applyRuleIds`.
   *
   * @type {number[]}
   * @memberof IPatchFeatureSecurityRules
   */
  removeRuleIds: number[];
}
