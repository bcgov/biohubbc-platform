import { IPolicyFormValues } from 'features/admin/policies/components/PolicyForm.interface';
import { IPolicyExpressionFormValues } from 'features/admin/policies/components/PolicyExpressionForm';
import { useApi } from 'hooks/useApi';
import { useDialogContext, usePolicyContext } from 'hooks/useContext';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import {
  ICreatePolicyStatementRequest,
  IPolicyExpression,
  IPolicyExpressionsResponse,
  IPolicyStatement,
  PolicyStatus
} from 'interfaces/usePoliciesApi.interface';
import { useState } from 'react';
import { PolicyDetailTab } from '../detail/header/PolicyHeader';

/**
 * State and actions for the policy detail page.
 *
 * @returns Policy detail page state and handlers.
 */
export const usePolicyDetailPage = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { policyId, policyDataLoader } = usePolicyContext();
  const [activeTab, setActiveTab] = useState<PolicyDetailTab>('expressions');
  const [isCreateExpressionDialogOpen, setIsCreateExpressionDialogOpen] = useState(false);
  const [isCreateStatementDialogOpen, setIsCreateStatementDialogOpen] = useState(false);
  const [editingExpression, setEditingExpression] = useState<IPolicyExpression | null>(null);
  const [editingStatement, setEditingStatement] = useState<IPolicyStatement | null>(null);
  const [isSavingExpression, setIsSavingExpression] = useState(false);
  const [isSavingStatement, setIsSavingStatement] = useState(false);
  const [isSavingPolicyStatus, setIsSavingPolicyStatus] = useState(false);
  const [isEditPolicyDialogOpen, setIsEditPolicyDialogOpen] = useState(false);
  const [isSavingPolicyDetails, setIsSavingPolicyDetails] = useState(false);
  const policy = policyDataLoader.data;

  const setSnackbar = (snackbarMessage: string) => {
    dialogContext.setSnackbar({
      open: true,
      snackbarMessage
    });
  };

  const setErrorSnackbar = (error: Error) => {
    setSnackbar(error.message);
  };

  const expressions = useServerPaginatedDataGrid<IPolicyExpression, IPolicyExpressionsResponse>({
    fetcher: (_search, pagination) => api.policies.getPolicyExpressions(policyId, pagination),
    extractData: (response) => response.expressions,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });

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
  const handleCreateStatement = async (values: ICreatePolicyStatementRequest) => {
    if (!policy) {
      return;
    }

    try {
      setIsSavingStatement(true);

      const createdStatement = await api.policies.createPolicyStatement(policy.policy_id, values);

      policyDataLoader.setData({
        ...policy,
        statements: [...policy.statements, createdStatement]
      });
      setIsCreateStatementDialogOpen(false);
      setSnackbar('Created statement');
    } catch (error) {
      setErrorSnackbar(error as Error);
    } finally {
      setIsSavingStatement(false);
    }
  };

  /**
   * Creates a policy-owned expression from the expression dialog.
   *
   * @param values - Expression form values submitted by the expression dialog.
   */
  const handleCreateExpression = async (values: IPolicyExpressionFormValues) => {
    if (!policy || !values.expression) {
      return;
    }

    try {
      setIsSavingExpression(true);

      const createdExpression = await api.policies.createPolicyExpression(policy.policy_id, {
        name: values.name,
        description: values.description || undefined,
        expression: values.expression
      });

      policyDataLoader.setData({
        ...policy,
        expressions: [...policy.expressions, createdExpression]
      });
      expressions.refresh();
      setIsCreateExpressionDialogOpen(false);
      setSnackbar('Created expression');
    } catch (error) {
      setErrorSnackbar(error as Error);
    } finally {
      setIsSavingExpression(false);
    }
  };

  /**
   * Updates the expression currently selected for editing.
   *
   * @param values - Updated expression form values submitted by the expression dialog.
   */
  const handleEditExpression = async (values: IPolicyExpressionFormValues) => {
    if (!policy || !editingExpression || !values.expression) {
      return;
    }

    try {
      setIsSavingExpression(true);

      const updatedExpression = await api.policies.updatePolicyExpression(
        policy.policy_id,
        editingExpression.policy_expression_id,
        {
          name: values.name,
          description: values.description || undefined,
          expression: values.expression
        }
      );

      policyDataLoader.setData({
        ...policy,
        expressions: policy.expressions.map((expression) =>
          expression.policy_expression_id === updatedExpression.policy_expression_id ? updatedExpression : expression
        )
      });
      expressions.refresh();
      setEditingExpression(null);
      setSnackbar('Updated expression');
    } catch (error) {
      setErrorSnackbar(error as Error);
    } finally {
      setIsSavingExpression(false);
    }
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
      onYes: async () => {
        dialogContext.setYesNoDialog({ open: false });

        try {
          setIsSavingExpression(true);

          await api.policies.deletePolicyExpression(policy.policy_id, expression.policy_expression_id);
          policyDataLoader.setData({
            ...policy,
            expressions: policy.expressions.filter(
              (policyExpression) => policyExpression.policy_expression_id !== expression.policy_expression_id
            )
          });
          expressions.refresh();
          setSnackbar('Deleted expression');
        } catch (error) {
          setErrorSnackbar(error as Error);
        } finally {
          setIsSavingExpression(false);
        }
      }
    });
  };

  /**
   * Replaces the statement currently selected for editing.
   *
   * @param values - Statement request submitted by the statement dialog.
   */
  const handleEditStatement = async (values: ICreatePolicyStatementRequest) => {
    if (!policy || !editingStatement) {
      return;
    }

    try {
      setIsSavingStatement(true);

      const updatedStatement = await api.policies.updatePolicyStatement(
        policy.policy_id,
        editingStatement.policy_statement_id,
        values
      );

      policyDataLoader.setData({
        ...policy,
        statements: policy.statements.map((statement) =>
          statement.policy_statement_id === updatedStatement.policy_statement_id ? updatedStatement : statement
        )
      });
      setEditingStatement(null);
      setSnackbar('Updated statement');
    } catch (error) {
      setErrorSnackbar(error as Error);
    } finally {
      setIsSavingStatement(false);
    }
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
      onYes: async () => {
        dialogContext.setYesNoDialog({ open: false });

        try {
          setIsSavingStatement(true);

          await api.policies.deletePolicyStatement(policy.policy_id, statement.policy_statement_id);
          policyDataLoader.setData({
            ...policy,
            statements: policy.statements.filter(
              (policyStatement) => policyStatement.policy_statement_id !== statement.policy_statement_id
            )
          });
          setSnackbar('Deleted statement');
        } catch (error) {
          setErrorSnackbar(error as Error);
        } finally {
          setIsSavingStatement(false);
        }
      }
    });
  };

  /**
   * Updates the policy status from the header status dropdown.
   *
   * @param nextStatus - Selected status value from the dropdown.
   */
  const handlePolicyStatusChange = async (nextStatus: string) => {
    if (!policy || nextStatus === policy.status) {
      return;
    }

    try {
      setIsSavingPolicyStatus(true);

      const updatedPolicy = await api.policies.updatePolicyStatus(policy.policy_id, {
        status: nextStatus as PolicyStatus
      });

      policyDataLoader.setData({
        ...policy,
        status: updatedPolicy.status
      });

      setSnackbar('Updated policy status');
    } catch (error) {
      setErrorSnackbar(error as Error);
    } finally {
      setIsSavingPolicyStatus(false);
    }
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
  const handleSavePolicyDetails = async (values: IPolicyFormValues) => {
    if (!policy) {
      return;
    }

    try {
      setIsSavingPolicyDetails(true);

      const updatedPolicy = await api.policies.updatePolicy(policy.policy_id, {
        name: values.name,
        description: values.description || undefined,
        status: values.status
      });

      policyDataLoader.setData({
        ...policy,
        ...updatedPolicy
      });
      setIsEditPolicyDialogOpen(false);
      setSnackbar('Updated policy');
    } catch (error) {
      setErrorSnackbar(error as Error);
    } finally {
      setIsSavingPolicyDetails(false);
    }
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
    policyDataLoader,
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
