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

export interface ISecurityReasonWithFeatureCount {
  security_rule_id: number;
  security_category_id: number;
  category_name: string;
  name: string;
  description: string | null;
  is_active: boolean;
  feature_count: number;
}

export interface ISecurityReason {
  security_rule_id: number;
  security_category_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface ICreateSecurityReasonRequest {
  name: string;
  description: string;
  security_category_id: number;
  is_active: boolean;
}

export interface IUpdateSecurityReasonRequest {
  name: string;
  description: string;
  security_category_id: number;
  is_active: boolean;
}

export interface ISecurityReasonsResponse {
  reasons: ISecurityReasonWithFeatureCount[];
  pagination: ApiPaginationResponseParams;
}
