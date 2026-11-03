import { ChipProps } from '@mui/material/Chip';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';

/** Label of a policy's status, which is also the decision on the data request the policy represents. */
export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  [PolicyStatus.REQUESTED]: 'Requested',
  [PolicyStatus.REVIEWED]: 'Reviewed',
  [PolicyStatus.APPROVED]: 'Approved',
  [PolicyStatus.DENIED]: 'Denied'
};

/** Chip colour of a policy's status. */
export const POLICY_STATUS_COLORS: Record<PolicyStatus, ChipProps['color']> = {
  [PolicyStatus.REQUESTED]: 'warning',
  [PolicyStatus.REVIEWED]: 'info',
  [PolicyStatus.APPROVED]: 'success',
  [PolicyStatus.DENIED]: 'error'
};
