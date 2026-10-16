import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { POLICY_STATUS_COLORS, POLICY_STATUS_LABELS } from 'constants/policy';
import { useApi } from 'hooks/useApi';
import { Link as RouterLink } from 'react-router-dom';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { AdminDataRequestPropertySection } from './AdminDataRequestPropertySection';

interface AdminDataRequestPolicyProps {
  policyId: string;
}

/**
 * Policy tab of the administrative data request page: the policy that represents the data request, with an Open
 * Policy action leading to the policy's own page, where it is managed.
 *
 * @param {AdminDataRequestPolicyProps} props The policy of the data request.
 * @returns {JSX.Element} Policy name, description, status and statements.
 */
export const AdminDataRequestPolicy = ({ policyId }: AdminDataRequestPolicyProps) => {
  const biohubApi = useApi();

  const policyQuery = useQuery({
    queryKey: policyQueryKeys.detail(policyId),
    queryFn: ({ signal }) => biohubApi.policies.getPolicy(policyId, { signal })
  });
  const policy = policyQuery.data;

  return (
    <>
      <QueryErrorDialog error={policyQuery.error} label="policy" />
      <AdminDataRequestPropertySection
        id="data-request-policy"
        label="Policy"
        headerContent={
          <Button component={RouterLink} to={`/admin/policy/${policyId}`} variant="outlined" size="small">
            Open Policy
          </Button>
        }
        rows={[
          { id: 'name', property: 'Name', value: policy?.name },
          { id: 'description', property: 'Description', value: policy?.description },
          {
            id: 'status',
            property: 'Status',
            value: policy && (
              <Chip
                label={POLICY_STATUS_LABELS[policy.status]}
                size="small"
                color={POLICY_STATUS_COLORS[policy.status]}
                sx={{ fontWeight: 700 }}
              />
            )
          },
          {
            id: 'statements',
            property: 'Statements',
            value: policy && (
              <Stack direction="row" gap={1} flexWrap="wrap">
                {policy.statements.map((statement) => (
                  <Chip
                    key={statement.policy_statement_id}
                    size="small"
                    label={`${statement.effect}: ${statement.submission_feature_urn}`}
                    color={statement.effect === 'allow' ? 'success' : 'error'}
                    variant="outlined"
                  />
                ))}
              </Stack>
            )
          }
        ]}
      />
    </>
  );
};
