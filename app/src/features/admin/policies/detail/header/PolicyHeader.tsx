import { mdiCheckCircleOutline, mdiCircleMedium, mdiCloseCircleOutline, mdiProgressClock } from '@mdi/js';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DropdownButton } from 'components/DropdownButton';
import { IPolicy, PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { PropsWithChildren } from 'react';
import { Link as RouterLink } from 'react-router-dom';

export type PolicyDetailTab = 'expressions' | 'statements' | 'teams';

const policyDetailTabs: { value: PolicyDetailTab; label: string }[] = [
  { value: 'expressions', label: 'Expressions' },
  { value: 'statements', label: 'Statements' },
  { value: 'teams', label: 'Teams' }
];

const policyStatusOptions = [
  { value: PolicyStatus.REQUESTED, label: 'Requested', iconPath: mdiProgressClock },
  { value: PolicyStatus.REVIEWED, label: 'Reviewed', iconPath: mdiCircleMedium },
  { value: PolicyStatus.APPROVED, label: 'Approved', iconPath: mdiCheckCircleOutline },
  { value: PolicyStatus.DENIED, label: 'Denied', iconPath: mdiCloseCircleOutline }
];

const policyStatusColorMap = {
  [PolicyStatus.REQUESTED]: 'warning',
  [PolicyStatus.REVIEWED]: 'info',
  [PolicyStatus.APPROVED]: 'success',
  [PolicyStatus.DENIED]: 'error'
} as const;

interface PolicyHeaderProps {
  policy: IPolicy;
  activeTab: PolicyDetailTab;
  isSavingPolicyStatus: boolean;
  isSavingPolicyDetails: boolean;
  onTabChange: (tab: PolicyDetailTab) => void;
  onPolicyStatusChange: (status: string) => void;
  onEditPolicy: () => void;
}

/**
 * Renders the policy detail page in the administrative page layout: the header with breadcrumb, name, description,
 * status actions and tabs, above the selected tab's content passed as children.
 *
 * @param {PropsWithChildren<PolicyHeaderProps>} props
 * @returns {JSX.Element}
 */
export const PolicyHeader = ({
  policy,
  activeTab,
  isSavingPolicyStatus,
  isSavingPolicyDetails,
  onTabChange,
  onPolicyStatusChange,
  onEditPolicy,
  children
}: PropsWithChildren<PolicyHeaderProps>) => (
  <AdminPageLayout
    breadcrumbs={
      <Breadcrumbs aria-label="policy breadcrumb">
        <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
          Administration
        </Link>
        <Link component={RouterLink} to="/admin/data-requests" underline="hover" color="inherit">
          Data Requests
        </Link>
        <Link component={RouterLink} to="/admin/data-requests?tab=policies" underline="hover" color="inherit">
          Policies
        </Link>
        <Typography variant="inherit" color="text.primary">
          {policy.name}
        </Typography>
      </Breadcrumbs>
    }
    title={policy.name}
    description={policy.description}
    descriptionDialogTitle="Policy Description"
    buttons={
      <Stack direction="row" spacing={1}>
        <DropdownButton
          value={policy.status}
          itemGroups={[{ groupId: 'policy-status', items: policyStatusOptions }]}
          color={policyStatusColorMap[policy.status]}
          size="small"
          disabled={isSavingPolicyStatus || isSavingPolicyDetails}
          data-testid="policy-status-dropdown"
          onSelect={onPolicyStatusChange}
        />
        <Button
          size="small"
          variant="outlined"
          onClick={onEditPolicy}
          disabled={isSavingPolicyStatus || isSavingPolicyDetails}
          data-testid="edit-policy-button">
          Edit
        </Button>
      </Stack>
    }
    tabs={policyDetailTabs}
    activeTab={activeTab}
    onTabChange={onTabChange}>
    {children}
  </AdminPageLayout>
);
