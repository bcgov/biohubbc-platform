import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useOptimisticDataLoader } from 'hooks/useOptimisticDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useEffect, useRef, useState } from 'react';
import { SelectedFeatureRulesPanel } from './SelectedFeatureRulesPanel';

interface SelectedFeatureRulesContainerProps {
  submissionId: number;
  submissionUploadId: string;
  submissionUploadReviewId: string;
  selectedFeatureIds: number[];
  expression?: ExpressionTreeExpression;
  refreshRevision: number;
  onRuleChanged: () => void;
  onChanged: () => void;
}

/**
 * Loads authoritative rule state and applies security changes for the current review scope.
 * @param {SelectedFeatureRulesContainerProps} props Review scope and refresh callbacks.
 * @returns {JSX.Element} Rule assignment controls.
 */
export const SelectedFeatureRulesContainer = (props: SelectedFeatureRulesContainerProps) => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const [loadError, setLoadError] = useState<unknown>();
  // The shared grid retains its refresh callback; read the current review scope when it fetches.
  const scopeRef = useRef(props);
  scopeRef.current = props;
  const ruleGrid = useServerPaginatedDataGrid({
    fetcher: async (search, pagination) => {
      setLoadError(undefined);
      const scope = scopeRef.current;
      try {
        return await api.admin.getSubmissionUploadReviewSelectedFeatureRules(
          scope.submissionId,
          scope.submissionUploadId,
          scope.submissionUploadReviewId,
          scope.selectedFeatureIds,
          { keyword: search, expression: scope.expression },
          pagination
        );
      } catch (error) {
        setLoadError(error);
        throw error;
      }
    },
    extractData: (response) => response.rules,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'applied', sort: 'desc' }
  });

  const optimisticRules = useOptimisticDataLoader({ data: ruleGrid.response, setData: ruleGrid.setData });
  const latestRuleGrid = useRef(ruleGrid);
  latestRuleGrid.current = ruleGrid;

  const { refresh: refreshRules } = ruleGrid;

  useEffect(() => {
    refreshRules();
  }, [
    props.submissionId,
    props.submissionUploadId,
    props.submissionUploadReviewId,
    props.selectedFeatureIds,
    props.expression,
    props.refreshRevision,
    refreshRules
  ]);

  /**
   * Optimistically changes one rule in place, rolls back on error, and refreshes feature-security state on success.
   * @param {(typeof ruleGrid.rows)[number]} rule Rule and current applied state.
   * @returns {Promise<void>} Resolves after refreshing or reporting an error.
   */
  const changeRule = async (rule: (typeof ruleGrid.rows)[number]): Promise<void> => {
    try {
      const mutation = rule.applied
        ? api.admin.deleteSubmissionUploadReviewSecurityRuleAssignments
        : api.admin.insertSubmissionUploadReviewSecurityRuleAssignments;
      // Do not refresh assignments after a toggle: applied-first sorting would move the touched rule.
      // Update it optimistically in place and refresh only the features table on success.
      await optimisticRules.refresh((currentData) => ({
        optimisticState: {
          ...currentData,
          rules: currentData.rules.map((row) =>
            row.security_rule_id === rule.security_rule_id ? { ...row, applied: !rule.applied } : row
          )
        },
        mutation: () =>
          mutation(
            props.submissionId,
            props.submissionUploadId,
            props.submissionUploadReviewId,
            props.selectedFeatureIds,
            rule.security_rule_id,
            props.expression
          ),
        onRollback: (_error, { optimisticState }) => {
          // Roll back only this change, preserving newer rule changes or a newly loaded scope.
          const currentGrid = latestRuleGrid.current;
          const response = currentGrid.response;
          const optimisticRule = optimisticState.rules.find((row) => row.security_rule_id === rule.security_rule_id);
          if (response) {
            currentGrid.setData({
              ...response,
              rules: response.rules.map((row) => (row === optimisticRule ? rule : row))
            });
          }
        }
      }));
      props.onRuleChanged();
    } catch (error) {
      dialogContext.setSnackbar({ open: true, snackbarMessage: (error as Error).message });
    }
  };

  /**
   * Resets direct assignments for the current scope and reloads authoritative state.
   * @returns {Promise<void>} Resolves after refreshing or reporting an error.
   */
  const resetSecurity = async (): Promise<void> => {
    dialogContext.setYesNoDialog({ open: false });
    try {
      await api.admin.deleteSubmissionUploadReviewSecurityAssignments(
        props.submissionId,
        props.submissionUploadId,
        props.submissionUploadReviewId,
        props.selectedFeatureIds,
        props.expression
      );
      ruleGrid.refresh();
      props.onChanged();
    } catch (error) {
      dialogContext.setSnackbar({ open: true, snackbarMessage: (error as Error).message });
    }
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
      rows={ruleGrid.rows}
      rowCount={ruleGrid.rowCount}
      isLoading={ruleGrid.isLoading && !ruleGrid.response}
      error={loadError}
      searchTerm={ruleGrid.searchTerm}
      onSearch={ruleGrid.handleSearch}
      paginationModel={ruleGrid.paginationModel}
      onPaginationModelChange={ruleGrid.handlePaginationChange}
      onChangeRule={changeRule}
      onReset={openResetDialog}
      onRetry={ruleGrid.refresh}
    />
  );
};
