import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ISubmissionUploadReviewSelectedFeatureRule } from 'interfaces/useAdminApi.interface';
import { useChangeSecurityRuleAssignmentMutation } from '../../hooks/useChangeSecurityRuleAssignmentMutation';
import { useResetSecurityAssignmentsMutation } from '../../hooks/useResetSecurityAssignmentsMutation';
import { SelectedFeatureRulesPanel } from './SelectedFeatureRulesPanel';

interface SelectedFeatureRulesContainerProps {
  submissionId: number;
  submissionUploadId: string;
  submissionUploadReviewId: string;
  selectedFeatureIds: number[];
  expression?: ExpressionTreeExpression;
}

/**
 * Loads authoritative rule state and applies security changes for the current review scope.
 *
 * The scope (selected features, or the applied expression without a selection) is part of the rules query
 * key, and the same scope is sent with every change, so a change always applies to the rules on screen.
 *
 * @param {SelectedFeatureRulesContainerProps} props Review scope.
 * @returns {JSX.Element} Rule assignment controls.
 */
export const SelectedFeatureRulesContainer = (props: SelectedFeatureRulesContainerProps) => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'applied', sort: 'desc' } });
  const changeRuleMutation = useChangeSecurityRuleAssignmentMutation(props);
  const resetMutation = useResetSecurityAssignmentsMutation(props);

  const rulesQueryKey = submissionUploadQueryKeys.selectedFeatureRules(props, {
    featureIds: props.selectedFeatureIds,
    expression: props.expression,
    keyword: grid.debouncedSearchTerm,
    pagination: grid.apiPagination
  });
  const rulesQuery = useQuery({
    queryKey: rulesQueryKey,
    queryFn: ({ signal }) =>
      api.admin.getSubmissionUploadReviewSelectedFeatureRules(
        props.submissionId,
        props.submissionUploadId,
        props.submissionUploadReviewId,
        props.selectedFeatureIds,
        { keyword: grid.debouncedSearchTerm, expression: props.expression },
        grid.apiPagination,
        { signal }
      ),
    placeholderData: keepPreviousData
  });

  /**
   * Applies or removes one rule for the current scope, flipping it in place until the server answers.
   *
   * @param {ISubmissionUploadReviewSelectedFeatureRule} rule Rule and current applied state.
   * @returns {void} Starts the change; the mutation reports a failure.
   */
  const changeRule = (rule: ISubmissionUploadReviewSelectedFeatureRule): void => {
    changeRuleMutation.mutate({
      rule,
      selectedFeatureIds: props.selectedFeatureIds,
      expression: props.expression,
      rulesQueryKey
    });
  };

  /**
   * Resets direct assignments for the current scope.
   *
   * @returns {void} Starts the reset; a snackbar reports a failure.
   */
  const resetSecurity = (): void => {
    dialogContext.setYesNoDialog({ open: false });
    resetMutation.mutate(
      { selectedFeatureIds: props.selectedFeatureIds, expression: props.expression },
      { onError: (error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message }) }
    );
  };

  /**
   * Opens confirmation for resetting selected features, or the whole upload when none are selected.
   *
   * @returns {void} Opens the shared confirmation dialog.
   */
  const openResetDialog = (): void => {
    const unselectedScope = props.expression ? 'all features matching the current search' : 'this submission upload';
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Reset Security',
      dialogText: props.selectedFeatureIds.length
        ? `Are you sure you want to clear all direct security rules from the ${props.selectedFeatureIds.length} selected feature(s)?`
        : `Are you sure you want to clear all direct security rules from ${unselectedScope}?`,
      yesButtonLabel: 'Reset',
      onClose: () => dialogContext.setYesNoDialog({ open: false }),
      onNo: () => dialogContext.setYesNoDialog({ open: false }),
      onYes: resetSecurity,
      yesButtonProps: undefined
    });
  };

  return (
    <SelectedFeatureRulesPanel
      rows={rulesQuery.data?.rules ?? []}
      rowCount={rulesQuery.data?.pagination.total ?? 0}
      isLoading={rulesQuery.isFetching && !rulesQuery.data}
      error={rulesQuery.isFetching ? null : rulesQuery.error}
      searchTerm={grid.searchTerm}
      onSearch={grid.handleSearch}
      paginationModel={grid.paginationModel}
      onPaginationModelChange={grid.handlePaginationChange}
      onChangeRule={changeRule}
      onReset={openResetDialog}
      onRetry={() => void rulesQuery.refetch()}
    />
  );
};
