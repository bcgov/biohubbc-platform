import { CreateContributorCodeset } from '../models/contributor-codeset';

export interface ContributorCodesetIdentity {
  contributor_id: number;
  key: string;
  version: string;
}

export type ContributorCodesetMetadata = Pick<CreateContributorCodeset, 'label' | 'description'>;

export type ContributorCodesetDefinition = ContributorCodesetIdentity & ContributorCodesetMetadata;
