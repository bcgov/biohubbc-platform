import { CreateContributorCodesetCode } from '../models/contributor-codeset-code';

export interface ContributorCodesetCodeIdentity {
  contributor_codeset_id: number;
  key: string;
}

export type ContributorCodesetCodeMetadata = Pick<
  CreateContributorCodesetCode,
  'external_id' | 'label' | 'description'
>;

export type ContributorCodesetCodeDefinition = ContributorCodesetCodeIdentity & ContributorCodesetCodeMetadata;
