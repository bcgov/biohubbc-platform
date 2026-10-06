import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IPolicyFormValues } from 'features/admin/policies/components/PolicyForm.interface';
import { IPolicyExpressionFormValues } from 'features/admin/policies/components/PolicyExpressionForm';
import { useApi } from 'hooks/useApi';
import { useDialogContext, usePolicyContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import {
  ICreatePolicyStatementRequest,
  IPolicyExpression,
  IPolicyStatement,
  PolicyStatus
} from 'interfaces/usePoliciesApi.interface';
import { useState } from 'react';
import { keepPreviousDataWithin, refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { PolicyDetailTab } from '../detail/header/PolicyHeader';
import { usePolicyQuery } from './usePolicyQuery';

/**
 * State and actions for the policy detail page.
 *
 * Saved changes refresh the policy from the server and invalidate its copies on other pages. Expression changes
 * also refresh the paginated expressions table; no mutation reconstructs the policy in the cache.
 *
 * @returns Policy detail page state and handlers.
 */
export const usePolicyDetailPage = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();
  const { policyId } = usePolicyContext();
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
   * Refreshes the changed policy and the lists and timelines that show it.
   *
   * @param {string} changedPolicyId The policy captured when the mutation started.
   * @returns {Promise<void>} Resolves after the visible policy has refreshed.
   */
  const refreshPolicy = (changedPolicyId: string): Promise<void> => {
    void refreshChangedQueries(queryClient, changedQueryKeys.policyListings());
    return queryClient.invalidateQueries({ queryKey: policyQueryKeys.detail(changedPolicyId) });
  };

  /**
   * Refreshes all pages of a policy's expressions after an expression change.
   *
   * @param {string} changedPolicyId The policy captured when the mutation started.
   * @returns {Promise<void>} Resolves after visible expression pages have refreshed.
   */
  const refreshExpressions = (changedPolicyId: string): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: policyQueryKeys.expressionsAll(changedPolicyId) });

  const expressionsGrid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const expressionsQuery = useQuery({
    queryKey: policyQueryKeys.expressions(policyId, expressionsGrid.apiPagination),
    queryFn: ({ signal }) => api.policies.getPolicyExpressions(policyId, expressionsGrid.apiPagination, { signal }),
    placeholderData: keepPreviousDataWithin(policyQueryKeys.expressionsAll(policyId))
  });
  const expressions = {
    grid: expressionsGrid,
    rows: expressionsQuery.data?.expressions ?? [],
    rowCount: expressionsQuery.data?.pagination.total ?? 0
  };

  const createStatementMutation = useMutation({
    mutationFn: (values: ICreatePolicyStatementRequest) => api.policies.createPolicyStatement(policyId, values),
    onMutate: () => policyId,
    onSuccess: async (_data, _variables, changedPolicyId) => {
      await refreshPolicy(changedPolicyId);
      setIsCreateStatementDialogOpen(false);
      setSnackbar('Created statement');
    },
    onError: setErrorSnackbar
  });

  const editStatementMutation = useMutation({
    mutationFn: ({ statementId, values }: { statementId: string; values: ICreatePolicyStatementRequest }) =>
      api.policies.updatePolicyStatement(policyId, statementId, values),
    onMutate: () => policyId,
    onSuccess: async (_data, _variables, changedPolicyId) => {
      await refreshPolicy(changedPolicyId);
      setEditingStatement(null);
      setSnackbar('Updated statement');
    },
    onError: setErrorSnackbar
  });

  const deleteStatementMutation = useMutation({
    mutationFn: (statementId: string) => api.policies.deletePolicyStatement(policyId, statementId),
    onMutate: () => policyId,
    onSuccess: async (_data, _variables, changedPolicyId) => {
      await refreshPolicy(changedPolicyId);
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
    onMutate: () => policyId,
    onSuccess: async (_data, _variables, changedPolicyId) => {
      await refreshPolicy(changedPolicyId);
      await refreshExpressions(changedPolicyId);
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
    onMutate: () => policyId,
    onSuccess: async (_data, _variables, changedPolicyId) => {
      await refreshPolicy(changedPolicyId);
      await refreshExpressions(changedPolicyId);
      setEditingExpression(null);
      setSnackbar('Updated expression');
    },
    onError: setErrorSnackbar
  });

  const deleteExpressionMutation = useMutation({
    mutationFn: (expressionId: string) => api.policies.deletePolicyExpression(policyId, expressionId),
    onMutate: () => policyId,
    onSuccess: async (_data, _variables, changedPolicyId) => {
      await refreshPolicy(changedPolicyId);
      await refreshExpressions(changedPolicyId);
      setSnackbar('Deleted expression');
    },
    onError: setErrorSnackbar
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: PolicyStatus) => api.policies.updatePolicyStatus(policyId, { status }),
    onMutate: () => policyId,
    onSuccess: async (_data, _variables, changedPolicyId) => {
      await refreshPolicy(changedPolicyId);
      setSnackbar('Updated policy status');
    },
    onError: setErrorSnackbar
  });

  const updateDetailsMutation = useMutation({
    mutationFn: (values: IPolicyFormValues) =>
      api.policies.updatePolicy(policyId, {
        name: values.name,
        description: values.description || undefined,
        status: values.status
      }),
    onMutate: () => policyId,
    onSuccess: async (_data, _variables, changedPolicyId) => {
      await refreshPolicy(changedPolicyId);
      setIsEditPolicyDialogOpen(false);
      setSnackbar('Updated policy');
    },
    onError: setErrorSnackbar
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
