import { IGetAllCodeSetsResponse } from 'interfaces/useCodesApi.interface';

export const codes: IGetAllCodeSetsResponse = {
  coordinator_agency: [{ id: 1, name: 'A Rocha Canada' }],
  management_action_type: [{ id: 1, name: 'Management action' }],
  first_nations: [{ id: 1, name: 'First nations code' }],
  funding_source: [{ id: 1, name: 'Funding source code' }],
  investment_action_category: [{ id: 1, fs_id: 1, name: 'Investment action category' }],
  activity: [{ id: 1, name: 'Activity code' }],
  region: [{ id: 1, name: 'Region code' }],
  species: [{ id: 1, name: 'Species code' }],
  proprietor_type: [
    { id: 1, name: 'Proprietor code 1', is_first_nation: false },
    { id: 2, name: 'First Nations Land', is_first_nation: true }
  ],
  iucn_conservation_action_level_1_classification: [
    { id: 1, name: 'IUCN class 1' },
    { id: 12, name: 'IUCN class 2' }
  ],
  iucn_conservation_action_level_2_subclassification: [
    { id: 1, iucn1_id: 1, name: 'IUCN subclass 1 - 1' },
    { id: 2, iucn1_id: 2, name: 'IUCN subclass 1 - 2' }
  ],
  iucn_conservation_action_level_3_subclassification: [
    { id: 1, iucn2_id: 1, name: 'IUCN subclass 2 - 1' },
    { id: 2, iucn2_id: 2, name: 'IUCN subclass 2 - 2' }
  ],
  system_roles: [
    { id: 1, name: 'Role 1' },
    { id: 2, name: 'Role 2' }
  ],
  administrative_activity_status_type: [
    { id: 1, name: 'Pending' },
    { id: 2, name: 'Actioned' },
    { id: 3, name: 'Rejected' }
  ],
  common_survey_methodologies: [
    { id: 1, name: 'Recruitment' },
    { id: 2, name: 'SRB' }
  ]
};
