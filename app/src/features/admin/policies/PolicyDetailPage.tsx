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
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import {
  ICreatePolicyStatementRequest,
  IPolicy,
  IPolicyStatement,
  PolicyStatus
} from 'interfaces/usePoliciesApi.interface';
import { SearchFeatureResponse } from 'interfaces/useSearchApi.interface';
import { ITeamPoliciesResponse, ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { PolicySkeleton } from './PolicySkeleton';

type PolicyDetailTab = 'expressions' | 'statements' | 'features' | 'teams';

type SearchablePolicyStatement = IPolicyStatement & {
  featureType: string;
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
  const [editingStatement, setEditingStatement] = useState<IPolicyStatement | null>(null);
  const [isSavingStatement, setIsSavingStatement] = useState(false);
  const [isSavingPolicyStatus, setIsSavingPolicyStatus] = useState(false);
  const [isEditPolicyDialogOpen, setIsEditPolicyDialogOpen] = useState(false);
  const [isSavingPolicyDetails, setIsSavingPolicyDetails] = useState(false);
  const policyDataLoader = useDataLoader((id: string) => api.policies.getPolicy(id));
  const policy = policyDataLoader.data;

  useEffect(() => {
    if (!policyId) {
      return;
    }

    policyDataLoader.load(policyId);
  }, [policyDataLoader, policyId]);

  const toStatementRequest = (statement: IPolicyStatement): ICreatePolicyStatementRequest => ({
    effect: statement.effect,
    submission_feature_urn: statement.submission_feature_urn,
    ...(statement.expression ? { expression: statement.expression } : {})
  });

  const handleCloseStatementDialog = () => {
    if (isSavingStatement) {
      return;
    }

    setIsCreateExpressionDialogOpen(false);
    setIsCreateStatementDialogOpen(false);
    setEditingStatement(null);
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
      setIsCreateExpressionDialogOpen(false);
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
          ...(values.expression ? { expression: values.expression } : {})
        }
      ],
      'Created statement'
    );
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
              ...(values.expression ? { expression: values.expression } : {})
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

  const expressionRows = useMemo(
    () => policy?.statements.filter((statement) => statement.expression) ?? [],
    [policy?.statements]
  );

  const expressionColumns: GridColDef<IPolicyStatement>[] = [
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
      headerName: 'Resource',
      flex: 1,
      minWidth: 260
    },
    {
      field: 'expression',
      headerName: 'Expression',
      flex: 2,
      minWidth: 360,
      renderCell: (params) => (
        <Typography
          component="span"
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
          {JSON.stringify(params.row.expression)}
        </Typography>
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
      headerName: 'Resource',
      flex: 1,
      minWidth: 260
    },
    {
      field: 'expression',
      headerName: 'Expression',
      minWidth: 150,
      valueGetter: (_value, row) => (row.expression ? 'Yes' : 'No')
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
            <CustomDataGrid
              data-testid="policy-expressions-table"
              rows={expressionRows}
              columns={expressionColumns}
              getRowId={(row) => row.policy_statement_id}
              disableRowSelectionOnClick
              disableColumnSelector
              noRowsMessage="No Expressions"
              hideFooter
              autoHeight
              sx={{ border: 'none' }}
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

        {activeTab === 'features' && <PolicyFeatureResults statements={loadedPolicy.statements} />}

        {activeTab === 'teams' && <PolicyTeams policyId={loadedPolicy.policy_id} />}
      </Container>

      <EditPolicyStatementDialog
        open={isCreateExpressionDialogOpen}
        isLoading={isSavingStatement}
        dialogTitle="Create Expression"
        onCancel={handleCloseStatementDialog}
        onSave={handleCreateStatement}
      />

      <EditPolicyStatementDialog
        open={isCreateStatementDialogOpen}
        isLoading={isSavingStatement}
        onCancel={handleCloseStatementDialog}
        onSave={handleCreateStatement}
      />

      <EditPolicyStatementDialog
        open={Boolean(editingStatement)}
        isLoading={isSavingStatement}
        mode="edit"
        initialValues={
          editingStatement
            ? {
                effect: editingStatement.effect,
                submission_feature_urn: editingStatement.submission_feature_urn,
                expression: editingStatement.expression ?? null,
                expression_error: undefined
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

  const teams = useServerPaginatedDataGrid<ITeamPolicyDetails, ITeamPoliciesResponse>({
    fetcher: (_search, pagination) => api.teamPolicies.getTeamPolicies({ policyIds: [policyId] }, pagination),
    extractData: (response) => response.team_policies,
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
}

/**
 * Renders search result tables for policy statement expressions.
 *
 * @param {PolicyFeatureResultsProps} props
 * @returns {JSX.Element}
 */
const PolicyFeatureResults = ({ statements }: PolicyFeatureResultsProps) => {
  const api = useApi();

  const searchableStatements = useMemo<SearchablePolicyStatement[]>(
    () =>
      statements.flatMap((statement) => {
        if (!statement.expression) {
          return [];
        }

        const featureType = getStatementFeatureType(statement.submission_feature_urn);

        if (!featureType) {
          return [];
        }

        return [{ ...statement, featureType }];
      }),
    [statements]
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
        <Typography color="text.secondary">No policy statement expressions with concrete feature types.</Typography>
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
