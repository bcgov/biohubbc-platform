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

export type IListPersecutionHarmResponse = Array<IPersecutionHarmRule>;

export interface IPersecutionHarmRule {
  persecution_or_harm_id: number;
  persecution_or_harm_type_id: number;
  wldtaxonomic_units_id: number;
  name: string;
  description: string | null;
}
