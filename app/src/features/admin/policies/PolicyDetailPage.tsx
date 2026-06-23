import {
  mdiCheckCircleOutline,
  mdiCircleMedium,
  mdiCloseCircleOutline,
  mdiDotsVertical,
  mdiPencilOutline,
  mdiProgressClock,
  mdiTrashCanOutline
} from '@mdi/js';
import Icon from '@mdi/react';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ContextMenuButton } from 'components/ContextMenuButton';
import { DropdownButton } from 'components/DropdownButton';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { PageSection } from 'components/section/PageSection';
import { TabGroup } from 'components/tabs/TabGroup';
import { SearchResultTableLayout } from 'features/search/result/layout/table/SearchResultTableLayout';
import {
  EditPolicyStatementDialog,
  IEditPolicyStatementFormValues
} from 'features/admin/policies/components/EditPolicyStatementDialog';
import { EditPolicyDialog } from 'features/admin/policies/components/EditPolicyDialog';
import { IPolicyFormValues } from 'features/admin/policies/components/PolicyForm';
import { PolicyExpressionDialog } from 'features/admin/policies/components/PolicyExpressionDialog';
import { IPolicyExpressionFormValues } from 'features/admin/policies/components/PolicyExpressionForm';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import {
  ICreatePolicyStatementRequest,
  IPolicy,
  IPolicyExpression,
  IPolicyExpressionsResponse,
  IPolicyTeamsResponse,
  IPolicyStatement,
  PolicyStatus
} from 'interfaces/usePoliciesApi.interface';
import { SearchFeatureResponse } from 'interfaces/useSearchApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { PolicySkeleton } from './PolicySkeleton';

type PolicyDetailTab = 'expressions' | 'statements' | 'features' | 'teams';

type SearchablePolicyStatement = IPolicyStatement & {
  featureType: string;
  expression: ExpressionTreeExpression;
};

const policyDetailTabs: { value: PolicyDetailTab; label: string }[] = [
  { value: 'expressions', label: 'Expressions' },
  { value: 'statements', label: 'Statements' },
  { value: 'features', label: 'Features' },
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

const getStatementFeatureType = (submissionFeatureUrn: string) => {
  const [, , featureType] = submissionFeatureUrn.split(':');

  if (!featureType || featureType === '*') {
    return null;
  }

  return featureType;
};

/**
 * Detail page for one policy and its statements.
 *
 * @returns {JSX.Element}
 */
export const PolicyDetailPage = () => {
  const { policyId } = useParams();
  const api = useApi();
  const dialogContext = useDialogContext();
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
  const policyDataLoader = useDataLoader((id: string) => api.policies.getPolicy(id));
  const policy = policyDataLoader.data;
  const expressions = useServerPaginatedDataGrid<IPolicyExpression, IPolicyExpressionsResponse>({
    fetcher: (_search, pagination) =>
      policyId
        ? api.policies.getPolicyExpressions(policyId, pagination)
        : Promise.resolve({
            expressions: [],
            pagination: { total: 0, current_page: 1, last_page: 1, per_page: pagination.limit }
          }),
    extractData: (response) => response.expressions,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });

  useEffect(() => {
    if (!policyId) {
      return;
    }

    policyDataLoader.load(policyId);
  }, [policyDataLoader, policyId]);

  const toStatementRequest = (statement: IPolicyStatement): ICreatePolicyStatementRequest => ({
    effect: statement.effect,
    submission_feature_urn: statement.submission_feature_urn,
    ...(statement.policy_expression_id ? { policy_expression_id: statement.policy_expression_id } : {})
  });

  const handleCloseStatementDialog = () => {
    if (isSavingStatement) {
      return;
    }

    setIsCreateStatementDialogOpen(false);
    setEditingStatement(null);
  };

  const handleCloseExpressionDialog = () => {
    if (isSavingExpression) {
      return;
    }

    setIsCreateExpressionDialogOpen(false);
    setEditingExpression(null);
  };

  const handleSaveStatements = async (
    statements: ICreatePolicyStatementRequest[],
    snackbarMessage: string
  ): Promise<void> => {
    if (!policy) {
      return;
    }

    try {
      setIsSavingStatement(true);

      const updatedPolicy = await api.policies.updatePolicy(policy.policy_id, {
        name: policy.name,
        description: policy.description || undefined,
        status: policy.status,
        statements
      });

      policyDataLoader.setData(updatedPolicy);
      setIsCreateStatementDialogOpen(false);
      setEditingStatement(null);
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage
      });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSavingStatement(false);
    }
  };

  const handleCreateStatement = async (values: IEditPolicyStatementFormValues) => {
    if (!policy) {
      return;
    }

    await handleSaveStatements(
      [
        ...policy.statements.map(toStatementRequest),
        {
          effect: values.effect,
          submission_feature_urn: values.submission_feature_urn,
          ...(values.policy_expression_id ? { policy_expression_id: values.policy_expression_id } : {})
        }
      ],
      'Created statement'
    );
  };

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
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Created expression'
      });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSavingExpression(false);
    }
  };

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
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Updated expression'
      });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSavingExpression(false);
    }
  };

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
            ),
            statements: policy.statements.map((statement) =>
              statement.policy_expression_id === expression.policy_expression_id
                ? { ...statement, policy_expression_id: undefined }
                : statement
            )
          });
          expressions.refresh();
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: 'Deleted expression'
          });
        } catch (error) {
          const apiError = error as APIError;
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: apiError.message
          });
        } finally {
          setIsSavingExpression(false);
        }
      }
    });
  };

  const handleEditStatement = async (values: IEditPolicyStatementFormValues) => {
    if (!policy || !editingStatement) {
      return;
    }

    await handleSaveStatements(
      policy.statements.map((statement) =>
        statement.policy_statement_id === editingStatement.policy_statement_id
          ? {
              effect: values.effect,
              submission_feature_urn: values.submission_feature_urn,
              ...(values.policy_expression_id ? { policy_expression_id: values.policy_expression_id } : {})
            }
          : toStatementRequest(statement)
      ),
      'Updated statement'
    );
  };

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
        await handleSaveStatements(
          policy.statements
            .filter((policyStatement) => policyStatement.policy_statement_id !== statement.policy_statement_id)
            .map(toStatementRequest),
          'Deleted statement'
        );
      }
    });
  };

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

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Updated policy status'
      });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSavingPolicyStatus(false);
    }
  };

  const handleClosePolicyDialog = () => {
    if (isSavingPolicyDetails) {
      return;
    }

    setIsEditPolicyDialogOpen(false);
  };

  const handleSavePolicyDetails = async (values: IPolicyFormValues) => {
    if (!policy) {
      return;
    }

    try {
      setIsSavingPolicyDetails(true);

      const updatedPolicy = await api.policies.updatePolicy(policy.policy_id, {
        name: values.name,
        description: values.description || undefined,
        status: values.status,
        statements: policy.statements.map(toStatementRequest)
      });

      policyDataLoader.setData(updatedPolicy);
      setIsEditPolicyDialogOpen(false);
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Updated policy'
      });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSavingPolicyDetails(false);
    }
  };

  const expressionColumns: GridColDef<IPolicyExpression>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 220
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 260,
      valueGetter: (_value, row) => row.description ?? ''
    },
    {
      field: 'expression',
      headerName: 'Expression',
      flex: 2,
      minWidth: 360,
      sortable: false,
      renderCell: (params) => (
        <Box
          component="pre"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            m: 0,
            overflow: 'visible',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
          {JSON.stringify(params.row.expression, null, 2)}
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <ContextMenuButton
          buttonTitle={`policy-expression-${params.row.policy_expression_id}-menu`}
          buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
          itemGroups={[
            {
              groupId: 'expression-actions',
              items: [
                {
                  label: 'Edit',
                  icon: <Icon path={mdiPencilOutline} size={0.875} />,
                  onClick: () => setEditingExpression(params.row)
                },
                {
                  label: 'Delete',
                  icon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                  onClick: () => handleDeleteExpressionClick(params.row)
                }
              ]
            }
          ]}
        />
      )
    }
  ];

  const columns: GridColDef<IPolicyStatement>[] = [
    {
      field: 'effect',
      headerName: 'Effect',
      minWidth: 140,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.effect}
          color={params.row.effect === 'allow' ? 'success' : 'error'}
          variant="outlined"
          sx={{ textTransform: 'capitalize' }}
        />
      )
    },
    {
      field: 'submission_feature_urn',
      headerName: 'URN',
      flex: 1,
      minWidth: 260
    },
    {
      field: 'policy_expression',
      headerName: 'Expression',
      flex: 1,
      minWidth: 220,
      valueGetter: (_value, row) => {
        const policyExpression = policy?.expressions.find(
          (expression) => expression.policy_expression_id === row.policy_expression_id
        );

        return policyExpression?.name || row.policy_expression_id || '';
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <ContextMenuButton
          buttonTitle={`policy-statement-${params.row.policy_statement_id}-menu`}
          buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
          itemGroups={[
            {
              groupId: 'statement-actions',
              items: [
                {
                  label: 'Edit',
                  icon: <Icon path={mdiPencilOutline} size={0.875} />,
                  onClick: () => setEditingStatement(params.row)
                },
                {
                  label: 'Delete',
                  icon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                  onClick: () => handleDeleteStatementClick(params.row)
                }
              ]
            }
          ]}
        />
      )
    }
  ];

  const renderContent = (loadedPolicy: IPolicy) => (
    <>
      <PageHeader
        maxWidth="xl"
        breadcrumbs={
          <Breadcrumbs aria-label="policy breadcrumb">
            <Link component={RouterLink} to="/admin/policies" underline="hover" color="inherit">
              Policy
            </Link>
            <Typography variant="inherit" color="text.primary">
              {loadedPolicy.name}
            </Typography>
          </Breadcrumbs>
        }
        label={<Typography variant="h1">{loadedPolicy.name}</Typography>}
        description={loadedPolicy.description}
        descriptionDialogTitle="Policy Description"
        buttons={
          <Stack direction="row" spacing={1}>
            <DropdownButton
              value={loadedPolicy.status}
              itemGroups={[{ groupId: 'policy-status', items: policyStatusOptions }]}
              valueColorMap={policyStatusColorMap}
              size="small"
              disabled={isSavingPolicyStatus || isSavingPolicyDetails}
              data-testid="policy-status-dropdown"
              onSelect={handlePolicyStatusChange}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => setIsEditPolicyDialogOpen(true)}
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
            onChange={setActiveTab}
            ariaLabel="Policy detail sections"
          />
        }
      />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {activeTab === 'expressions' && (
          <PageSection
            id="policy-expressions"
            label="Expressions"
            addLabel="Create Expression"
            onAdd={() => setIsCreateExpressionDialogOpen(true)}>
            <ServerPaginatedDataGrid<IPolicyExpression>
              dataTestId="policy-expressions-table"
              rows={expressions.rows}
              columns={expressionColumns}
              getRowId={(row) => row.policy_expression_id}
              noRowsMessage="No Expressions"
              rowCount={expressions.rowCount}
              paginationModel={expressions.paginationModel}
              setPaginationModel={expressions.handlePaginationChange}
              sortModel={expressions.sortModel}
              setSortModel={expressions.handleSortChange}
              getRowHeight={() => 'auto'}
              getEstimatedRowHeight={() => 160}
              sx={{
                '& .MuiDataGrid-cell': {
                  alignItems: 'flex-start',
                  py: 1.5
                },
                '& .MuiDataGrid-cell[data-field="expression"] > *': {
                  overflow: 'visible',
                  whiteSpace: 'normal'
                }
              }}
            />
          </PageSection>
        )}

        {activeTab === 'statements' && (
          <PageSection
            id="policy-statements"
            label="Statements"
            addLabel="Create Statement"
            onAdd={() => setIsCreateStatementDialogOpen(true)}>
            <CustomDataGrid
              data-testid="policy-statements-table"
              rows={loadedPolicy.statements}
              columns={columns}
              getRowId={(row) => row.policy_statement_id}
              disableRowSelectionOnClick
              disableColumnSelector
              noRowsMessage="No Statements"
              hideFooter
              autoHeight
              sx={{ border: 'none' }}
            />
          </PageSection>
        )}

        {activeTab === 'features' && (
          <PolicyFeatureResults statements={loadedPolicy.statements} expressions={loadedPolicy.expressions} />
        )}

        {activeTab === 'teams' && <PolicyTeams policyId={loadedPolicy.policy_id} />}
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
        policyExpressions={loadedPolicy.expressions}
        onCancel={handleCloseStatementDialog}
        onSave={handleCreateStatement}
      />

      <EditPolicyStatementDialog
        open={Boolean(editingStatement)}
        isLoading={isSavingStatement}
        policyExpressions={loadedPolicy.expressions}
        mode="edit"
        initialValues={
          editingStatement
            ? {
                effect: editingStatement.effect,
                submission_feature_urn: editingStatement.submission_feature_urn,
                policy_expression_id: editingStatement.policy_expression_id ?? ''
              }
            : undefined
        }
        onCancel={handleCloseStatementDialog}
        onSave={handleEditStatement}
      />

      {policy && (
        <EditPolicyDialog
          open={isEditPolicyDialogOpen}
          isLoading={isSavingPolicyDetails}
          policy={policy}
          onCancel={handleClosePolicyDialog}
          onSave={handleSavePolicyDetails}
        />
      )}
    </>
  );

  return (
    <LoadingGuard
      isLoading={policyDataLoader.isLoading && !policy}
      isLoadingFallback={<PolicySkeleton />}
      isLoadingFallbackDelay={300}>
      {policy ? renderContent(policy) : null}
    </LoadingGuard>
  );
};

interface PolicyTeamsProps {
  policyId: string;
}

/**
 * Renders teams with access to a policy via team_policy assignments.
 *
 * @param {PolicyTeamsProps} props
 * @returns {JSX.Element}
 */
const PolicyTeams = ({ policyId }: PolicyTeamsProps) => {
  const api = useApi();

  const teams = useServerPaginatedDataGrid<ITeamPolicyDetails, IPolicyTeamsResponse>({
    fetcher: (_search, pagination) => api.policies.getPolicyTeams(policyId, pagination),
    extractData: (response) => response.teams,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'team_name', sort: 'asc' }
  });

  const columns = useMemo<GridColDef<ITeamPolicyDetails>[]>(
    () => [
      {
        field: 'team_name',
        headerName: 'Team',
        flex: 1,
        minWidth: 220
      },
      {
        field: 'team_id',
        headerName: 'Team ID',
        flex: 1,
        minWidth: 260
      }
    ],
    []
  );

  return (
    <PageSection id="policy-teams" label="Teams">
      <ServerPaginatedDataGrid<ITeamPolicyDetails>
        dataTestId="policy-teams-table"
        rows={teams.rows}
        columns={columns}
        getRowId={(row) => row.team_policy_id}
        noRowsMessage="No Teams"
        rowCount={teams.rowCount}
        paginationModel={teams.paginationModel}
        setPaginationModel={teams.handlePaginationChange}
        sortModel={teams.sortModel}
        setSortModel={teams.handleSortChange}
      />
    </PageSection>
  );
};

interface PolicyFeatureResultsProps {
  statements: IPolicyStatement[];
  expressions: IPolicyExpression[];
}

/**
 * Renders search result tables for policy statements with linked expressions.
 *
 * @param {PolicyFeatureResultsProps} props
 * @returns {JSX.Element}
 */
const PolicyFeatureResults = ({ statements, expressions }: PolicyFeatureResultsProps) => {
  const api = useApi();

  const searchableStatements = useMemo<SearchablePolicyStatement[]>(
    () =>
      statements.flatMap((statement) => {
        const policyExpression = expressions.find(
          (expression) => expression.policy_expression_id === statement.policy_expression_id
        );

        if (!policyExpression) {
          return [];
        }

        const featureType = getStatementFeatureType(statement.submission_feature_urn);

        if (!featureType) {
          return [];
        }

        return [{ ...statement, featureType, expression: policyExpression.expression }];
      }),
    [expressions, statements]
  );

  const featureSearchDataLoader = useDataLoader(
    useCallback(
      async (searchablePolicyStatements: SearchablePolicyStatement[]) => {
        const responses = await Promise.all(
          searchablePolicyStatements.map(async (statement) => {
            const response = await api.search.searchFeatures(statement.featureType, statement.expression, {
              page: 1,
              limit: 10
            });

            return { statement, response };
          })
        );

        return responses;
      },
      [api.search]
    )
  );

  useEffect(() => {
    if (!searchableStatements.length) {
      return;
    }

    featureSearchDataLoader.load(searchableStatements);
  }, [featureSearchDataLoader, searchableStatements]);

  return (
    <PageSection id="policy-features" label="Features">
      {!searchableStatements.length && (
        <Typography color="text.secondary">
          No policy statements with linked expressions and concrete feature types.
        </Typography>
      )}

      {Boolean(searchableStatements.length) && (
        <LoadingGuard
          isLoading={featureSearchDataLoader.isLoading && !featureSearchDataLoader.data}
          isLoadingFallbackDelay={300}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {featureSearchDataLoader.data?.map(({ statement, response }) => (
              <PolicyFeatureResultTable key={statement.policy_statement_id} statement={statement} response={response} />
            ))}
          </Box>
        </LoadingGuard>
      )}
    </PageSection>
  );
};

interface PolicyFeatureResultTableProps {
  statement: SearchablePolicyStatement;
  response: SearchFeatureResponse;
}

/**
 * Renders feature search results for one policy statement expression.
 *
 * @param {PolicyFeatureResultTableProps} props
 * @returns {JSX.Element}
 */
const PolicyFeatureResultTable = ({ statement, response }: PolicyFeatureResultTableProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Box>
      <Typography component="h3" variant="h6" sx={{ textTransform: 'capitalize' }}>
        {statement.effect}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {statement.submission_feature_urn}
      </Typography>
    </Box>

    {response.features.length ? (
      <SearchResultTableLayout results={response.features} featureTypeProperties={response.properties} />
    ) : (
      <Typography color="text.secondary">No matching features.</Typography>
    )}
  </Box>
);
