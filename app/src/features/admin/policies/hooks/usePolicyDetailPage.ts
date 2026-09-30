import { keepPreviousData, QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IPolicyFormValues } from 'features/admin/policies/components/PolicyForm.interface';
import { IPolicyExpressionFormValues } from 'features/admin/policies/components/PolicyExpressionForm';
import { useApi } from 'hooks/useApi';
import { useDialogContext, usePolicyContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import {
  ICreatePolicyStatementRequest,
  IPolicy,
  IPolicyExpression,
  IPolicyStatement,
  PolicyStatus
} from 'interfaces/usePoliciesApi.interface';
import { useState } from 'react';
import {
  holdReloadIfConcurrent,
  joinMutationGroup,
  refreshChangedQueries,
  settleMutationGroup
} from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { PolicyDetailTab } from '../detail/header/PolicyHeader';
import { usePolicyQuery } from './usePolicyQuery';

/** The policy a change was started against, captured when `mutate` is called. */
interface PolicyMutationScope {
  policyId: string;
  policyQueryKey: QueryKey;
}

/**
 * State and actions for the policy detail page.
 *
 * The policy, with its statements and expressions, is one cached query; each change writes the saved result into it
 * with `setQueryData`, and refreshes the policy's copies on other pages. Expression changes also invalidate the
 * paginated expressions table.
 *
 * @returns Policy detail page state and handlers.
 */
export const usePolicyDetailPage = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();
  const { policyId, policyQueryKey } = usePolicyContext();
  const policyQuery = usePolicyQuery();
  const [activeTab, setActiveTab] = useState<PolicyDetailTab>('expressions');
  const [isCreateExpressionDialogOpen, setIsCreateExpressionDialogOpen] = useState(false);
  const [isCreateStatementDialogOpen, setIsCreateStatementDialogOpen] = useState(false);
  const [editingExpression, setEditingExpression] = useState<IPolicyExpression | null>(null);
  const [editingStatement, setEditingStatement] = useState<IPolicyStatement | null>(null);
  const [isEditPolicyDialogOpen, setIsEditPolicyDialogOpen] = useState(false);
  const policy = policyQuery.data;

  /**
   * Shows a message in the shared snackbar.
   *
   * @param {string} snackbarMessage The message.
   */
  const setSnackbar = (snackbarMessage: string) => {
    dialogContext.setSnackbar({
      open: true,
      snackbarMessage
    });
  };

  /**
   * Reports a failed change in the shared snackbar.
   *
   * @param {Error} error The failure.
   */
  const setErrorSnackbar = (error: Error) => {
    setSnackbar(error.message);
  };

  /**
   * Captures the policy a change applies to, so its result is written to that policy's cache entry.
   *
   * @returns {PolicyMutationScope} The route's policy and its detail key.
   */
  const captureScope = (): PolicyMutationScope => ({ policyId, policyQueryKey });

  /**
   * Counts a status or details change into the policy's mutation group, then captures the policy it applies to.
   *
   * @returns {PolicyMutationScope} The route's policy and its detail key.
   */
  const joinGroupAndCaptureScope = (): PolicyMutationScope => {
    joinMutationGroup(queryClient, policyQueryKey);
    return captureScope();
  };

  /**
   * Writes a change into a cached policy, leaving the cache untouched while the policy has not loaded.
   *
   * @param {QueryKey} key The policy detail key.
   * @param {(policy: IPolicy) => IPolicy} update Builds the changed policy.
   */
  const patchPolicy = (key: QueryKey, update: (current: IPolicy) => IPolicy) => {
    queryClient.setQueryData<IPolicy>(key, (current) => current && update(current));
  };

  /**
   * Reloads every page of a policy's expressions table.
   *
   * @param {string} changedPolicyId The policy whose expressions changed.
   */
  const invalidateExpressions = (changedPolicyId: string) => {
    void queryClient.invalidateQueries({ queryKey: policyQueryKeys.expressionsAll(changedPolicyId) });
  };

  /**
   * Refreshes the policy's copies outside this page after a change.
   *
   * @returns {void}
   */
  const refreshPolicyElsewhere = () => refreshChangedQueries(queryClient, changedQueryKeys.policyListings());

  const expressionsGrid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const expressionsQuery = useQuery({
    queryKey: policyQueryKeys.expressions(policyId, expressionsGrid.apiPagination),
    queryFn: ({ signal }) => api.policies.getPolicyExpressions(policyId, expressionsGrid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });
  const expressions = {
    grid: expressionsGrid,
    rows: expressionsQuery.data?.expressions ?? [],
    rowCount: expressionsQuery.data?.pagination.total ?? 0
  };

  const createStatementMutation = useMutation({
    mutationFn: (values: ICreatePolicyStatementRequest) => api.policies.createPolicyStatement(policyId, values),
    onMutate: captureScope,
    onSuccess: (createdStatement, _values, scope) => {
      refreshPolicyElsewhere();
      patchPolicy(scope.policyQueryKey, (current) => ({
        ...current,
        statements: [...current.statements, createdStatement]
      }));
      setIsCreateStatementDialogOpen(false);
      setSnackbar('Created statement');
    },
    onError: setErrorSnackbar
  });

  const editStatementMutation = useMutation({
    mutationFn: ({ statementId, values }: { statementId: string; values: ICreatePolicyStatementRequest }) =>
      api.policies.updatePolicyStatement(policyId, statementId, values),
    onMutate: captureScope,
    onSuccess: (updatedStatement, _variables, scope) => {
      refreshPolicyElsewhere();
      patchPolicy(scope.policyQueryKey, (current) => ({
        ...current,
        statements: current.statements.map((statement) =>
          statement.policy_statement_id === updatedStatement.policy_statement_id ? updatedStatement : statement
        )
      }));
      setEditingStatement(null);
      setSnackbar('Updated statement');
    },
    onError: setErrorSnackbar
  });

  const deleteStatementMutation = useMutation({
    mutationFn: (statementId: string) => api.policies.deletePolicyStatement(policyId, statementId),
    onMutate: captureScope,
    onSuccess: (_data, statementId, scope) => {
      refreshPolicyElsewhere();
      patchPolicy(scope.policyQueryKey, (current) => ({
        ...current,
        statements: current.statements.filter((statement) => statement.policy_statement_id !== statementId)
      }));
      setSnackbar('Deleted statement');
    },
    onError: setErrorSnackbar
  });

  const createExpressionMutation = useMutation({
    mutationFn: (values: IPolicyExpressionFormValues & { expression: IPolicyExpression['expression'] }) =>
      api.policies.createPolicyExpression(policyId, {
        name: values.name,
        description: values.description || undefined,
        expression: values.expression
      }),
    onMutate: captureScope,
    onSuccess: (createdExpression, _values, scope) => {
      refreshPolicyElsewhere();
      patchPolicy(scope.policyQueryKey, (current) => ({
        ...current,
        expressions: [...current.expressions, createdExpression]
      }));
      invalidateExpressions(scope.policyId);
      setIsCreateExpressionDialogOpen(false);
      setSnackbar('Created expression');
    },
    onError: setErrorSnackbar
  });

  const editExpressionMutation = useMutation({
    mutationFn: ({
      expressionId,
      values
    }: {
      expressionId: string;
      values: IPolicyExpressionFormValues & { expression: IPolicyExpression['expression'] };
    }) =>
      api.policies.updatePolicyExpression(policyId, expressionId, {
        name: values.name,
        description: values.description || undefined,
        expression: values.expression
      }),
    onMutate: captureScope,
    onSuccess: (updatedExpression, _variables, scope) => {
      refreshPolicyElsewhere();
      patchPolicy(scope.policyQueryKey, (current) => ({
        ...current,
        expressions: current.expressions.map((expression) =>
          expression.policy_expression_id === updatedExpression.policy_expression_id ? updatedExpression : expression
        )
      }));
      invalidateExpressions(scope.policyId);
      setEditingExpression(null);
      setSnackbar('Updated expression');
    },
    onError: setErrorSnackbar
  });

  const deleteExpressionMutation = useMutation({
    mutationFn: (expressionId: string) => api.policies.deletePolicyExpression(policyId, expressionId),
    onMutate: captureScope,
    onSuccess: (_data, expressionId, scope) => {
      refreshPolicyElsewhere();
      patchPolicy(scope.policyQueryKey, (current) => ({
        ...current,
        expressions: current.expressions.filter((expression) => expression.policy_expression_id !== expressionId)
      }));
      invalidateExpressions(scope.policyId);
      setSnackbar('Deleted expression');
    },
    onError: setErrorSnackbar
  });

  const updateStatusMutation = useMutation({
    // Status and details changes share this key: each response carries the policy's status, and one saved alongside
    // the other can predate it.
    mutationKey: policyQueryKey,
    mutationFn: (status: PolicyStatus) => api.policies.updatePolicyStatus(policyId, { status }),
    onMutate: joinGroupAndCaptureScope,
    onSuccess: (updatedPolicy, _status, scope) => {
      refreshPolicyElsewhere();
      if (!holdReloadIfConcurrent(queryClient, scope.policyQueryKey, scope.policyQueryKey)) {
        patchPolicy(scope.policyQueryKey, (current) => ({ ...current, status: updatedPolicy.status }));
      }
      setSnackbar('Updated policy status');
    },
    onError: setErrorSnackbar,
    onSettled: (_data, _error, _status, scope) =>
      settleMutationGroup(queryClient, scope?.policyQueryKey ?? policyQueryKey)
  });

  const updateDetailsMutation = useMutation({
    mutationKey: policyQueryKey,
    mutationFn: (values: IPolicyFormValues) =>
      api.policies.updatePolicy(policyId, {
        name: values.name,
        description: values.description || undefined,
        status: values.status
      }),
    onMutate: joinGroupAndCaptureScope,
    onSuccess: (updatedPolicy, _values, scope) => {
      refreshPolicyElsewhere();
      if (!holdReloadIfConcurrent(queryClient, scope.policyQueryKey, scope.policyQueryKey)) {
        patchPolicy(scope.policyQueryKey, (current) => ({ ...current, ...updatedPolicy }));
      }
      setIsEditPolicyDialogOpen(false);
      setSnackbar('Updated policy');
    },
    onError: setErrorSnackbar,
    onSettled: (_data, _error, _values, scope) =>
      settleMutationGroup(queryClient, scope?.policyQueryKey ?? policyQueryKey)
  });

  const isSavingExpression =
    createExpressionMutation.isPending || editExpressionMutation.isPending || deleteExpressionMutation.isPending;
  const isSavingStatement =
    createStatementMutation.isPending || editStatementMutation.isPending || deleteStatementMutation.isPending;
  const isSavingPolicyStatus = updateStatusMutation.isPending;
  const isSavingPolicyDetails = updateDetailsMutation.isPending;

  /**
   * Opens the create expression dialog from the expressions tab toolbar.
   */
  const openCreateExpressionDialog = () => {
    setIsCreateExpressionDialogOpen(true);
  };

  /**
   * Opens the create statement dialog from the statements tab toolbar.
   */
  const openCreateStatementDialog = () => {
    setIsCreateStatementDialogOpen(true);
  };

  /**
   * Opens the edit policy dialog from the detail page header.
   */
  const openEditPolicyDialog = () => {
    setIsEditPolicyDialogOpen(true);
  };

  /**
   * Selects an expression row for editing.
   *
   * @param expression - Policy expression row selected from the expressions table.
   */
  const selectExpressionForEdit = (expression: IPolicyExpression) => {
    setEditingExpression(expression);
  };

  /**
   * Selects a statement row for editing.
   *
   * @param statement - Policy statement row selected from the statements table.
   */
  const selectStatementForEdit = (statement: IPolicyStatement) => {
    setEditingStatement(statement);
  };

  /**
   * Closes the create/edit statement dialog unless a statement save is in progress.
   */
  const handleCloseStatementDialog = () => {
    if (isSavingStatement) {
      return;
    }

    setIsCreateStatementDialogOpen(false);
    setEditingStatement(null);
  };

  /**
   * Closes the create/edit expression dialog unless an expression save is in progress.
   */
  const handleCloseExpressionDialog = () => {
    if (isSavingExpression) {
      return;
    }

    setIsCreateExpressionDialogOpen(false);
    setEditingExpression(null);
  };

  /**
   * Adds a new statement to the current policy using values from the statement dialog.
   *
   * @param values - Statement request submitted by the statement dialog.
   */
  const handleCreateStatement = (values: ICreatePolicyStatementRequest) => {
    if (!policy) {
      return;
    }

    createStatementMutation.mutate(values);
  };

  /**
   * Creates a policy-owned expression from the expression dialog.
   *
   * @param values - Expression form values submitted by the expression dialog.
   */
  const handleCreateExpression = (values: IPolicyExpressionFormValues) => {
    if (!policy || !values.expression) {
      return;
    }

    createExpressionMutation.mutate({ ...values, expression: values.expression });
  };

  /**
   * Updates the expression currently selected for editing.
   *
   * @param values - Updated expression form values submitted by the expression dialog.
   */
  const handleEditExpression = (values: IPolicyExpressionFormValues) => {
    if (!policy || !editingExpression || !values.expression) {
      return;
    }

    editExpressionMutation.mutate({
      expressionId: editingExpression.policy_expression_id,
      values: { ...values, expression: values.expression }
    });
  };

  /**
   * Opens a confirmation dialog and deletes the selected expression if confirmed.
   *
   * @param expression - Policy expression row selected from the expressions table.
   */
  const handleDeleteExpressionClick = (expression: IPolicyExpression) => {
    if (!policy) {
      return;
    }

    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete Expression',
      dialogText: 'Are you sure you want to delete this policy expression?',
      yesButtonLabel: 'Delete',
      noButtonLabel: 'Cancel',
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onClose: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onYes: () => {
        dialogContext.setYesNoDialog({ open: false });
        deleteExpressionMutation.mutate(expression.policy_expression_id);
      }
    });
  };

  /**
   * Replaces the statement currently selected for editing.
   *
   * @param values - Statement request submitted by the statement dialog.
   */
  const handleEditStatement = (values: ICreatePolicyStatementRequest) => {
    if (!policy || !editingStatement) {
      return;
    }

    editStatementMutation.mutate({ statementId: editingStatement.policy_statement_id, values });
  };

  /**
   * Opens a confirmation dialog and removes the selected statement if confirmed.
   *
   * @param statement - Policy statement row selected from the statements table.
   */
  const handleDeleteStatementClick = (statement: IPolicyStatement) => {
    if (!policy) {
      return;
    }

    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete Statement',
      dialogText: 'Are you sure you want to delete this policy statement?',
      yesButtonLabel: 'Delete',
      noButtonLabel: 'Cancel',
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onClose: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onYes: () => {
        dialogContext.setYesNoDialog({ open: false });
        deleteStatementMutation.mutate(statement.policy_statement_id);
      }
    });
  };

  /**
   * Updates the policy status from the header status dropdown.
   *
   * @param nextStatus - Selected status value from the dropdown.
   */
  const handlePolicyStatusChange = (nextStatus: string) => {
    if (!policy || nextStatus === policy.status) {
      return;
    }

    updateStatusMutation.mutate(nextStatus as PolicyStatus);
  };

  /**
   * Closes the edit policy dialog unless a metadata save is in progress.
   */
  const handleClosePolicyDialog = () => {
    if (isSavingPolicyDetails) {
      return;
    }

    setIsEditPolicyDialogOpen(false);
  };

  /**
   * Updates policy metadata while preserving the current statement list.
   *
   * @param values - Policy metadata submitted by the edit policy dialog.
   */
  const handleSavePolicyDetails = (values: IPolicyFormValues) => {
    if (!policy) {
      return;
    }

    updateDetailsMutation.mutate(values);
  };

  return {
    activeTab,
    editingExpression,
    editingStatement,
    expressions,
    isCreateExpressionDialogOpen,
    isCreateStatementDialogOpen,
    isEditPolicyDialogOpen,
    isSavingExpression,
    isSavingPolicyDetails,
    isSavingPolicyStatus,
    isSavingStatement,
    policy,
    isLoadingPolicy: policyQuery.isLoading,
    handleCloseExpressionDialog,
    handleClosePolicyDialog,
    handleCloseStatementDialog,
    handleCreateExpression,
    handleCreateStatement,
    handleDeleteExpressionClick,
    handleDeleteStatementClick,
    handleEditExpression,
    handleEditStatement,
    handlePolicyStatusChange,
    handleSavePolicyDetails,
    openCreateExpressionDialog,
    openCreateStatementDialog,
    openEditPolicyDialog,
    selectExpressionForEdit,
    selectStatementForEdit,
    setActiveTab
  };
};
