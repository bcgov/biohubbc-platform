import Container from '@mui/material/Container';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { EditPolicyStatementDialog } from 'features/admin/policies/components/EditPolicyStatementDialog';
import { EditPolicyDialog } from 'features/admin/policies/components/EditPolicyDialog';
import { PolicyExpressionDialog } from 'features/admin/policies/components/PolicyExpressionDialog';
import { PolicyExpressions } from './detail/expressions/PolicyExpressions';
import { PolicyDetailTab, PolicyHeader } from './detail/header/PolicyHeader';
import { PolicySkeleton } from './detail/skeleton/PolicySkeleton';
import { PolicyStatements } from './detail/statements/PolicyStatements';
import { PolicyTeams } from './detail/teams/PolicyTeams';
import { usePolicyDetailPage } from './hooks/usePolicyDetailPage';

/**
 * Detail page for one policy and its statements.
 *
 * @returns {JSX.Element}
 */
export const PolicyDetailPage = () => {
  const {
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
  } = usePolicyDetailPage();

  return (
    <LoadingGuard
      isLoading={policyDataLoader.isLoading && !policy}
      isLoadingFallback={<PolicySkeleton />}
      isLoadingFallbackDelay={300}>
      {policy ? (
        <>
          <PolicyHeader
            policy={policy}
            activeTab={activeTab}
            isSavingPolicyDetails={isSavingPolicyDetails}
            isSavingPolicyStatus={isSavingPolicyStatus}
            onEditPolicy={openEditPolicyDialog}
            onPolicyStatusChange={handlePolicyStatusChange}
            onTabChange={setActiveTab}
          />

          <Container maxWidth="xl" sx={{ py: 4 }}>
            <ComponentSwitch<PolicyDetailTab>
              switch={activeTab}
              components={{
                expressions: (
                  <PolicyExpressions
                    expressions={expressions}
                    onCreate={openCreateExpressionDialog}
                    onEdit={selectExpressionForEdit}
                    onDelete={handleDeleteExpressionClick}
                  />
                ),
                statements: (
                  <PolicyStatements
                    policy={policy}
                    onCreate={openCreateStatementDialog}
                    onEdit={selectStatementForEdit}
                    onDelete={handleDeleteStatementClick}
                  />
                ),
                teams: <PolicyTeams policyId={policy.policy_id} />
              }}
            />
          </Container>

          <PolicyExpressionDialog
            open={isCreateExpressionDialogOpen}
            isLoading={isSavingExpression}
            mode="create"
            onCancel={handleCloseExpressionDialog}
            onSave={handleCreateExpression}
          />

          {editingExpression && (
            <PolicyExpressionDialog
              open={Boolean(editingExpression)}
              isLoading={isSavingExpression}
              mode="edit"
              initialValues={{
                name: editingExpression.name ?? '',
                description: editingExpression.description ?? '',
                expression: editingExpression.expression,
                expression_error: undefined
              }}
              onCancel={handleCloseExpressionDialog}
              onSave={handleEditExpression}
            />
          )}

          <EditPolicyStatementDialog
            open={isCreateStatementDialogOpen}
            isLoading={isSavingStatement}
            policyExpressions={policy.expressions}
            onCancel={handleCloseStatementDialog}
            onSave={handleCreateStatement}
          />

          <EditPolicyStatementDialog
            open={Boolean(editingStatement)}
            isLoading={isSavingStatement}
            policyExpressions={policy.expressions}
            mode="edit"
            initialValues={
              editingStatement
                ? {
                    effect: editingStatement.effect,
                    submission_feature_urn: editingStatement.submission_feature_urn,
                    policy_expression_id: editingStatement.policy_expression_id
                  }
                : undefined
            }
            onCancel={handleCloseStatementDialog}
            onSave={handleEditStatement}
          />

          <EditPolicyDialog
            open={isEditPolicyDialogOpen}
            isLoading={isSavingPolicyDetails}
            policy={policy}
            onCancel={handleClosePolicyDialog}
            onSave={handleSavePolicyDetails}
          />
        </>
      ) : null}
    </LoadingGuard>
  );
};
