import { CreateContributorCodeset } from '../models/contributor-codeset';

export interface ContributorCodesetIdentity {
  contributor_id: number;
  key: string;
}

export type ContributorCodesetMetadata = Pick<CreateContributorCodeset, 'external_id' | 'label' | 'description'>;

export type ContributorCodesetDefinition = ContributorCodesetIdentity & ContributorCodesetMetadata;
