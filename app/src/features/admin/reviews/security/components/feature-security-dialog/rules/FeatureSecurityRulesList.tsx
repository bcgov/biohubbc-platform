import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TablePagination from '@mui/material/TablePagination';
import Typography from '@mui/material/Typography';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { useState } from 'react';
import { FeatureSecurityRuleCard } from './card/FeatureSecurityRuleCard';

interface FeatureSecurityRulesListProps {
  submissionId: number;
  submissionUploadId: string;
  submissionUploadReviewId: string;
  submissionFeatureId: number;
  onChanged: () => void;
}

/**
 * Loads paginated security rule cards and removes direct assignments from the feature.
 * @param {FeatureSecurityRulesListProps} props Feature context and security change handler.
 * @returns {React.JSX.Element} Paginated security cards with removal and loading feedback.
 */
export const FeatureSecurityRulesList = (props: FeatureSecurityRulesListProps) => {
  const api = useApi();
  const [error, setError] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const ruleGrid = useServerPaginatedDataGrid({
    fetcher: async (_search, pagination) => {
      setLoadError(undefined);
      try {
        return await api.admin.getSubmissionUploadReviewFeatureRules(
          props.submissionId,
          props.submissionUploadId,
          props.submissionUploadReviewId,
          props.submissionFeatureId,
          pagination
        );
      } catch (error) {
        setLoadError((error as Error).message);
        throw error;
      }
    },
    extractData: (response) => response.rules,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });

  /**
   * Removes one direct rule and refreshes the dialog and feature security state.
   * @param {number} ruleId Rule to remove from this feature.
   * @returns {Promise<void>} Resolves after refreshing the affected views.
   */
  const removeRule = async (ruleId: number): Promise<void> => {
    setError(undefined);
    try {
      await api.admin.deleteSubmissionUploadReviewSecurityRuleAssignments(
        props.submissionId,
        props.submissionUploadId,
        props.submissionUploadReviewId,
        [props.submissionFeatureId],
        ruleId
      );
      props.onChanged();
      if (ruleGrid.rows.length === 1 && ruleGrid.paginationModel.page > 0) {
        ruleGrid.handlePaginationChange({ ...ruleGrid.paginationModel, page: ruleGrid.paginationModel.page - 1 });
      } else {
        ruleGrid.refresh();
      }
    } catch (error) {
      setError((error as Error).message);
    }
  };

  return (
    <Stack spacing={1}>
      {ruleGrid.isLoading && !ruleGrid.response && (
        <Stack spacing={2} aria-label="Loading security rules">
          <Skeleton variant="rounded" height={88} />
          <Skeleton variant="rounded" height={88} />
          <Skeleton variant="rounded" height={88} />
        </Stack>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {loadError ? (
        <Alert severity="error" action={<Button onClick={() => ruleGrid.refresh()}>Try Again</Button>}>
          {loadError}
        </Alert>
      ) : null}
      {!ruleGrid.isLoading && !loadError && !ruleGrid.rows.length && (
        <Typography>No security rules affect this feature.</Typography>
      )}
      {ruleGrid.rows.map((rule) => (
        <FeatureSecurityRuleCard
          key={rule.security_rule_id}
          rule={rule}
          onRemove={() => removeRule(rule.security_rule_id)}
        />
      ))}
      <TablePagination
        component="div"
        count={ruleGrid.rowCount}
        page={ruleGrid.paginationModel.page}
        rowsPerPage={ruleGrid.paginationModel.pageSize}
        rowsPerPageOptions={[10, 25, 50]}
        onPageChange={(_event, page) => ruleGrid.handlePaginationChange({ ...ruleGrid.paginationModel, page })}
        onRowsPerPageChange={(event) =>
          ruleGrid.handlePaginationChange({ page: 0, pageSize: Number(event.target.value) })
        }
      />
    </Stack>
  );
};
