import { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';

export const POLICY_STATUS_OPTIONS: ICustomAutocompleteOption<PolicyStatus>[] = [
  { value: PolicyStatus.REQUESTED, label: 'Requested' },
  { value: PolicyStatus.REVIEWED, label: 'Reviewed' },
  { value: PolicyStatus.APPROVED, label: 'Approved' },
  { value: PolicyStatus.DENIED, label: 'Denied' }
];
