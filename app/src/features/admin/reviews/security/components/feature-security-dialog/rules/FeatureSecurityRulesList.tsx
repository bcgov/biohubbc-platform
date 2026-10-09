import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TablePagination from '@mui/material/TablePagination';
import Typography from '@mui/material/Typography';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useRemoveFeatureSecurityRuleMutation } from '../../../hooks/useRemoveFeatureSecurityRuleMutation';
import { FeatureSecurityRuleCard } from './card/FeatureSecurityRuleCard';

interface FeatureSecurityRulesListProps {
  submissionId: number;
  submissionUploadId: string;
  submissionUploadReviewId: string;
  submissionFeatureId: number;
}

/**
 * Loads paginated security rule cards and removes direct assignments from the feature.
 *
 * @param {FeatureSecurityRulesListProps} props Feature and review identifiers.
 * @returns {React.JSX.Element} Paginated security cards with removal and loading feedback.
 */
export const FeatureSecurityRulesList = (props: FeatureSecurityRulesListProps) => {
  const api = useApi();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const removeRuleMutation = useRemoveFeatureSecurityRuleMutation(props);
  const rulesQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureRules(props, props.submissionFeatureId, grid.apiPagination),
    queryFn: ({ signal }) =>
      api.admin.getSubmissionUploadReviewFeatureRules(
        props.submissionId,
        props.submissionUploadId,
        props.submissionUploadReviewId,
        props.submissionFeatureId,
        grid.apiPagination,
        { signal }
      ),
    placeholderData: keepPreviousData
  });
  const rules = rulesQuery.data?.rules ?? [];
  const loadError = rulesQuery.isFetching ? null : rulesQuery.error;

  /**
   * Removes one direct rule, stepping back a page when it was the last rule on the page.
   *
   * @param {number} ruleId Rule to remove from this feature.
   * @returns {void} Starts the removal; the failure is shown above the list.
   */
  const removeRule = (ruleId: number): void => {
    removeRuleMutation.mutate(
      { submissionFeatureId: props.submissionFeatureId, securityRuleId: ruleId },
      {
        onSuccess: () => {
          if (rules.length === 1 && grid.paginationModel.page > 0) {
            grid.handlePaginationChange({ ...grid.paginationModel, page: grid.paginationModel.page - 1 });
          }
        }
      }
    );
  };

  return (
    <Stack spacing={1}>
      {rulesQuery.isFetching && !rulesQuery.data && (
        <Stack spacing={2} aria-label="Loading security rules">
          <Skeleton variant="rounded" height={88} />
          <Skeleton variant="rounded" height={88} />
          <Skeleton variant="rounded" height={88} />
        </Stack>
      )}
      {removeRuleMutation.error && <Alert severity="error">{removeRuleMutation.error.message}</Alert>}
      {loadError ? (
        <Alert severity="error" action={<Button onClick={() => void rulesQuery.refetch()}>Try Again</Button>}>
          {loadError.message}
        </Alert>
      ) : null}
      {!rulesQuery.isFetching && !loadError && !rules.length && (
        <Typography>No security rules affect this feature.</Typography>
      )}
      {rules.map((rule) => (
        <FeatureSecurityRuleCard
          key={rule.security_rule_id}
          rule={rule}
          onRemove={() => removeRule(rule.security_rule_id)}
        />
      ))}
      <TablePagination
        component="div"
        count={rulesQuery.data?.pagination.total ?? 0}
        page={grid.paginationModel.page}
        rowsPerPage={grid.paginationModel.pageSize}
        rowsPerPageOptions={[10, 25, 50]}
        onPageChange={(_event, page) => grid.handlePaginationChange({ ...grid.paginationModel, page })}
        onRowsPerPageChange={(event) => grid.handlePaginationChange({ page: 0, pageSize: Number(event.target.value) })}
      />
    </Stack>
  );
};
