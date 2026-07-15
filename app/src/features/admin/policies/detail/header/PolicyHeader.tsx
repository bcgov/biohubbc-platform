import { mdiCheckCircleOutline, mdiCircleMedium, mdiCloseCircleOutline, mdiProgressClock } from '@mdi/js';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DropdownButton } from 'components/DropdownButton';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { IPolicy, PolicyStatus } from 'interfaces/usePoliciesApi.interface';
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
 * Header for the policy detail page.
 *
 * @param {PolicyHeaderProps} props
 * @returns {JSX.Element}
 */
export const PolicyHeader = ({
  policy,
  activeTab,
  isSavingPolicyStatus,
  isSavingPolicyDetails,
  onTabChange,
  onPolicyStatusChange,
  onEditPolicy
}: PolicyHeaderProps) => (
  <PageHeader
    maxWidth="xl"
    breadcrumbs={
      <Breadcrumbs aria-label="policy breadcrumb">
        <Link component={RouterLink} to="/admin/policies" underline="hover" color="inherit">
          Policy
        </Link>
        <Typography variant="inherit" color="text.primary">
          {policy.name}
        </Typography>
      </Breadcrumbs>
    }
    label={<Typography variant="h1">{policy.name}</Typography>}
    description={policy.description}
    descriptionDialogTitle="Policy Description"
    buttons={
      <Stack direction="row" spacing={1}>
        <DropdownButton
          value={policy.status}
          itemGroups={[{ groupId: 'policy-status', items: policyStatusOptions }]}
          valueColorMap={policyStatusColorMap}
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
    tabs={
      <TabGroup<PolicyDetailTab>
        value={activeTab}
        tabs={policyDetailTabs}
        onChange={onTabChange}
        ariaLabel="Policy detail sections"
      />
    }
  />
);
