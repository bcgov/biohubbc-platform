import { ApiPaginationResponseParams } from 'types/pagination';

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

export interface ISecurityCategoryWithRuleCount {
  security_category_id: number;
  name: string;
  description: string | null;
  rule_count: number;
}

export interface ISecurityCategory {
  security_category_id: number;
  name: string;
  description: string | null;
}

/** A security category with when it was created and the name of the user who created it. */
export interface ISecurityCategoryDetails {
  security_category_id: number;
  name: string;
  description: string | null;
  create_date: string;
  created_by_name: string | null;
}

export interface ICreateSecurityCategoryRequest {
  name: string;
  description: string;
}

export interface IUpdateSecurityCategoryRequest {
  name: string;
  description: string;
}

export interface ISecurityCategoriesResponse {
  categories: ISecurityCategoryWithRuleCount[];
  pagination: ApiPaginationResponseParams;
}

export interface ISecurityRuleWithFeatureCount {
  security_rule_id: number;
  security_category_id: number;
  category_name: string;
  name: string;
  description: string | null;
  is_active: boolean;
  feature_count: number;
}

export interface ISecurityRule {
  security_rule_id: number;
  security_category_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface ICreateSecurityRuleRequest {
  name: string;
  description: string;
  security_category_id: number;
  is_active: boolean;
}

export interface IUpdateSecurityRuleRequest {
  name: string;
  description: string;
  security_category_id: number;
  is_active: boolean;
}

/** Filters of the security rules list: a name search, and the security category to limit the rules to. */
export interface ISecurityRulesSearchParams {
  search?: string;
  security_category_id?: number;
}

export interface ISecurityRulesResponse {
  reasons: ISecurityRuleWithFeatureCount[];
  pagination: ApiPaginationResponseParams;
}
