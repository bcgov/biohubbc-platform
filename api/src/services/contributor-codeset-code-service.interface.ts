import { CreateContributorCodesetCode } from '../models/contributor-codeset-code';

export interface ContributorCodesetCodeIdentity {
  contributor_codeset_id: number;
  key: string;
  version: string;
}

export type ContributorCodesetCodeMetadata = Pick<CreateContributorCodesetCode, 'label' | 'description'>;

export type ContributorCodesetCodeDefinition = ContributorCodesetCodeIdentity & ContributorCodesetCodeMetadata;
