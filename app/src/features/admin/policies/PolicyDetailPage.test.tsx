import userEvent from '@testing-library/user-event';
import { DialogContext, IDialogContext, defaultSnackbarProps } from 'contexts/dialogContext';
import { AdminPolicyContextProvider } from 'contexts/policyContext';
import { useApi } from 'hooks/useApi';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { IPolicy, IPolicyExpression, PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { PolicyDetailPage } from './PolicyDetailPage';

vi.mock('hooks/useApi');

type PolicyDetailTestRow = IPolicy['statements'][number] | IPolicyExpression | ITeamPolicyDetails;

vi.mock('components/data-grid/CustomDataGrid', () => ({
  default: ({
    rows,
    columns,
    getRowId,
    'data-testid': dataTestId
  }: {
    rows: PolicyDetailTestRow[];
    columns: {
      field: string;
      renderCell?: (params: { row: PolicyDetailTestRow }) => ReactNode;
      valueGetter?: (value: unknown, row: PolicyDetailTestRow) => unknown;
    }[];
    getRowId?: (row: PolicyDetailTestRow) => string;
    'data-testid'?: string;
  }) => (
    <div data-testid={dataTestId ?? 'policy-statements-table'}>
      {rows.map((row) => (
        <div
          key={
            getRowId?.(row) ??
            ('policy_statement_id' in row
              ? row.policy_statement_id
              : 'policy_expression_id' in row
                ? row.policy_expression_id
                : row.team_policy_id)
          }>
          {columns.map((column) => (
            <div key={column.field}>
              {column.renderCell?.({ row }) ??
                String(
                  column.valueGetter?.(row[column.field as keyof PolicyDetailTestRow], row) ??
                    row[column.field as keyof PolicyDetailTestRow] ??
                    ''
                )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}));

vi.mock('components/ContextMenuButton', () => ({
  ContextMenuButton: ({
    buttonTitle,
    itemGroups
  }: {
    buttonTitle: string;
    itemGroups: { groupId: string; items: { label: string; onClick: () => void }[] }[];
  }) => (
    <div>
      {itemGroups.flatMap((group) =>
        group.items.map((item) => (
          <button key={`${group.groupId}-${item.label}`} type="button" onClick={item.onClick}>
            {`${buttonTitle}-${item.label}`}
          </button>
        ))
      )}
    </div>
  )
}));

vi.mock('components/expression-builder/PolicyExpressionBuilder', () => ({
  PolicyExpressionBuilder: ({
    onChange,
    onValidationChange,
    readOnly
  }: {
    onChange?: (value: ExpressionTreeExpression | null) => void;
    onValidationChange?: (error: string | null) => void;
    readOnly?: boolean;
  }) =>
    readOnly ? (
      <div data-testid="readonly-policy-expression">Read-only expression</div>
    ) : (
      <button
        type="button"
        onClick={() => {
          onChange?.({
            type: 'expression',
            operator: 'AND',
            clauses: [
              {
                type: 'predicate',
                feature_property_id: 1,
                feature_type_property_id: 1,
                operator: 'Equals',
                value: 'sensitive'
              }
            ]
          });
          onValidationChange?.(null);
        }}>
        Set expression
      </button>
    )
}));

const mockUseApi = useApi as Mock;

const expression: ExpressionTreeExpression = {
  type: 'expression',
  operator: 'AND',
  clauses: [
    {
      type: 'predicate',
      feature_property_id: 1,
      feature_type_property_id: 1,
      operator: 'Equals',
      value: 'sensitive'
    }
  ]
};

const policy: IPolicy = {
  policy_id: 'policy-1',
  name: 'Sensitive Wildlife Policy',
  description: 'Policy description',
  status: PolicyStatus.APPROVED,
  expressions: [
    {
      policy_expression_id: 'policy-expression-1',
      policy_id: 'policy-1',
      expression_id: 'expression-1',
      name: 'Sensitive species',
      description: 'Filters sensitive species observations',
      expression
    },
    {
      policy_expression_id: 'policy-expression-without-name',
      policy_id: 'policy-1',
      expression_id: 'expression-without-name',
      name: null,
      description: null,
      expression
    }
  ],
  statements: [
    {
      policy_statement_id: 'statement-1',
      policy_id: 'policy-1',
      effect: 'allow',
      submission_feature_urn: 'urn:*:telemetry:*',
      policy_expression_id: 'policy-expression-1'
    },
    {
      policy_statement_id: 'statement-2',
      policy_id: 'policy-1',
      effect: 'deny',
      submission_feature_urn: 'urn:*:sample_site:*',
      policy_expression_id: 'policy-expression-without-name'
    }
  ]
};

const renderPage = (dialogContext?: Partial<IDialogContext>) =>
  render(
    <DialogContext.Provider
      value={{
        setYesNoDialog: vi.fn(),
        yesNoDialogProps: {
          dialogTitle: '',
          dialogText: '',
          open: false,
          onClose: vi.fn(),
          onNo: vi.fn(),
          onYes: vi.fn()
        },
        setErrorDialog: vi.fn(),
        errorDialogProps: {
          dialogTitle: '',
          dialogText: '',
          open: false,
          onClose: vi.fn(),
          onOk: vi.fn()
        },
        setOkDialog: vi.fn(),
        okDialogProps: {
          dialogTitle: '',
          dialogText: '',
          open: false,
          onClose: vi.fn()
        },
        setSnackbar: vi.fn(),
        snackbarProps: defaultSnackbarProps,
        ...dialogContext
      }}>
      <MemoryRouter initialEntries={['/admin/policy/policy-1']}>
        <Routes>
          <Route
            path="/admin/policy/:policyId"
            element={
              <AdminPolicyContextProvider>
                <PolicyDetailPage />
              </AdminPolicyContextProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </DialogContext.Provider>
  );

describe('PolicyDetailPage', () => {
  const getPolicy = vi.fn();
  const getPolicyExpressions = vi.fn();
  const getPolicyTeams = vi.fn();
  const updatePolicy = vi.fn();
  const createPolicyExpression = vi.fn();
  const updatePolicyExpression = vi.fn();
  const deletePolicyExpression = vi.fn();
  const updatePolicyStatus = vi.fn();

  beforeEach(() => {
    getPolicy.mockReset();
    getPolicyExpressions.mockReset();
    getPolicyTeams.mockReset();
    updatePolicy.mockReset();
    createPolicyExpression.mockReset();
    updatePolicyExpression.mockReset();
    deletePolicyExpression.mockReset();
    updatePolicyStatus.mockReset();

    getPolicy.mockResolvedValue(policy);
    getPolicyExpressions.mockResolvedValue({
      expressions: policy.expressions,
      pagination: {
        total: policy.expressions.length,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: 'name',
        order: 'asc'
      }
    });
    updatePolicyStatus.mockResolvedValue({
      policy_id: 'policy-1',
      name: 'Sensitive Wildlife Policy',
      description: 'Policy description',
      status: PolicyStatus.DENIED
    });
    updatePolicy.mockResolvedValue({
      ...policy,
      statements: [
        ...policy.statements,
        {
          policy_statement_id: 'statement-3',
          policy_id: 'policy-1',
          effect: 'allow',
          submission_feature_urn: 'urn:1:telemetry:*',
          policy_expression_id: 'policy-expression-1'
        }
      ]
    });
    createPolicyExpression.mockResolvedValue({
      policy_expression_id: 'policy-expression-2',
      policy_id: 'policy-1',
      expression_id: 'expression-2',
      name: 'Telemetry sites',
      description: 'Filters telemetry sites',
      expression
    });
    updatePolicyExpression.mockResolvedValue({
      policy_expression_id: 'policy-expression-1',
      policy_id: 'policy-1',
      expression_id: 'expression-3',
      name: 'Updated sensitive species',
      description: 'Updated filters',
      expression
    });
    deletePolicyExpression.mockResolvedValue(undefined);
    getPolicyTeams.mockResolvedValue({
      teams: [
        {
          team_policy_id: 'team-policy-1',
          team_id: 'team-1',
          policy_id: 'policy-1',
          team_name: 'Team Alpha',
          policy_name: 'Sensitive Wildlife Policy'
        }
      ],
      pagination: {
        total: 1,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: 'team_name',
        order: 'asc'
      }
    });

    mockUseApi.mockReturnValue({
      policies: {
        getPolicy,
        getPolicyExpressions,
        getPolicyTeams,
        createPolicyExpression,
        updatePolicyExpression,
        deletePolicyExpression,
        updatePolicy,
        updatePolicyStatus
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the policy header, breadcrumbs, and expressions section', async () => {
    const { getByRole, getByText, getByTestId } = renderPage();

    await waitFor(() => {
      expect(getByRole('heading', { name: 'Sensitive Wildlife Policy' })).toBeVisible();
      expect(getByText('Policy')).toBeVisible();
      expect(getByText('Policy description')).toBeVisible();
      expect(getByRole('heading', { name: 'Expressions' })).toBeVisible();
      expect(getByRole('tab', { name: 'Expressions' })).toBeVisible();
      expect(getByRole('tab', { name: 'Statements' })).toBeVisible();
      expect(getByRole('tab', { name: 'Teams' })).toBeVisible();
      expect(getByTestId('policy-expressions-table')).toBeVisible();
      expect(getByText('Sensitive species')).toBeVisible();
      expect(getByText('Filters sensitive species observations')).toBeVisible();
      expect(getByTestId('policy-expressions-table').textContent).toContain(JSON.stringify(expression, null, 2));
    });
    expect(getPolicyExpressions).toHaveBeenCalledWith('policy-1', { page: 1, limit: 10, sort: 'name', order: 'asc' });
  });

  it('renders the statements section from the statements tab', async () => {
    const user = userEvent.setup();
    const { findByRole, findByTestId, getByText } = renderPage();

    await user.click(await findByRole('tab', { name: 'Statements' }));

    expect(await findByTestId('policy-statements-table')).toBeVisible();
    expect(getByText('urn:*:telemetry:*')).toBeVisible();
    expect(getByText('urn:*:sample_site:*')).toBeVisible();
    expect(getByText('Sensitive species')).toBeVisible();
    expect(getByText('policy-expression-without-name')).toBeVisible();
  });

  it('shows the policy skeleton while loading and no policy is available', async () => {
    getPolicy.mockReturnValue(new Promise(() => undefined));

    const { findByTestId } = renderPage();

    expect(await findByTestId('policy-skeleton')).toBeVisible();
  });

  it('renders teams with access to the policy', async () => {
    const user = userEvent.setup();
    const { findByRole, findByTestId, getByText } = renderPage();

    await user.click(await findByRole('tab', { name: 'Teams' }));

    expect(await findByTestId('policy-teams-table')).toBeVisible();
    expect(getByText('Team Alpha')).toBeVisible();

    await waitFor(() => {
      expect(getPolicyTeams).toHaveBeenCalledWith('policy-1', { page: 1, limit: 10, sort: 'team_name', order: 'asc' });
    });
  });

  it('updates the policy status from the header dropdown', async () => {
    const user = userEvent.setup();
    const { findByTestId, findByRole, getByRole } = renderPage();

    await user.click(await findByTestId('policy-status-dropdown'));
    await user.click(await findByRole('menuitem', { name: 'Denied' }));

    await waitFor(() => {
      expect(updatePolicyStatus).toHaveBeenCalledWith('policy-1', { status: PolicyStatus.DENIED });
    });
    expect(getByRole('button', { name: 'Denied' })).toBeVisible();
  });

  it('edits policy metadata from the header edit button', async () => {
    const user = userEvent.setup();
    updatePolicy.mockResolvedValueOnce({
      ...policy,
      name: 'Updated Policy',
      description: 'Updated description',
      status: PolicyStatus.APPROVED
    });
    const { findByTestId, findByRole, getByLabelText, getByRole, getByTestId } = renderPage();

    await user.click(await findByTestId('edit-policy-button'));
    expect(await findByRole('heading', { name: 'Edit Policy' })).toBeVisible();

    await user.clear(getByLabelText('Policy Name *'));
    await user.type(getByLabelText('Policy Name *'), 'Updated Policy');
    await user.clear(getByLabelText('Description'));
    await user.type(getByLabelText('Description'), 'Updated description');
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(updatePolicy).toHaveBeenCalledWith('policy-1', {
        name: 'Updated Policy',
        description: 'Updated description',
        status: PolicyStatus.APPROVED,
        statements: policy.statements
      });
    });
    expect(getByRole('heading', { name: 'Updated Policy' })).toBeVisible();
  });

  it('creates a policy expression from the expressions toolbar', async () => {
    const user = userEvent.setup();
    const { findByTestId, findByRole, getByRole, getByText, getByTestId } = renderPage();

    await user.click(await findByTestId('policy-expressions-add-button'));
    expect(await findByRole('heading', { name: 'Create Expression' })).toBeVisible();

    await user.type(getByRole('textbox', { name: 'Name' }), 'Telemetry sites');
    await user.type(getByRole('textbox', { name: 'Description' }), 'Filters telemetry sites');
    await user.click(getByText('Set expression'));
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(createPolicyExpression).toHaveBeenCalledWith('policy-1', {
        name: 'Telemetry sites',
        description: 'Filters telemetry sites',
        expression
      });
    });
    expect(updatePolicy).not.toHaveBeenCalled();
    expect(getPolicy).toHaveBeenCalledTimes(1);
    expect(getPolicyExpressions).toHaveBeenCalledTimes(2);
  });

  it('edits a policy expression from the row actions menu', async () => {
    const user = userEvent.setup();
    const { findByText, findByRole, getByRole, getByText, getByTestId } = renderPage();

    await user.click(await findByText('policy-expression-policy-expression-1-menu-Edit'));
    expect(await findByRole('heading', { name: 'Edit Expression' })).toBeVisible();

    await user.clear(getByRole('textbox', { name: 'Name' }));
    await user.type(getByRole('textbox', { name: 'Name' }), 'Updated sensitive species');
    await user.clear(getByRole('textbox', { name: 'Description' }));
    await user.type(getByRole('textbox', { name: 'Description' }), 'Updated filters');
    await user.click(getByText('Set expression'));
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(updatePolicyExpression).toHaveBeenCalledWith('policy-1', 'policy-expression-1', {
        name: 'Updated sensitive species',
        description: 'Updated filters',
        expression
      });
    });
    expect(updatePolicy).not.toHaveBeenCalled();
    expect(getPolicyExpressions).toHaveBeenCalledTimes(2);

    await user.click(await findByRole('tab', { name: 'Statements' }));
    expect(await findByText('Updated sensitive species')).toBeVisible();
  });

  it('deletes a policy expression from the row actions menu after confirmation', async () => {
    const user = userEvent.setup();
    const setYesNoDialog = vi.fn();
    const { findByText } = renderPage({ setYesNoDialog });

    await user.click(await findByText('policy-expression-policy-expression-1-menu-Delete'));

    expect(setYesNoDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        dialogTitle: 'Delete Expression',
        dialogText: 'Are you sure you want to delete this policy expression?',
        yesButtonLabel: 'Delete'
      })
    );

    const confirmationConfig = setYesNoDialog.mock.calls[0][0];
    await act(async () => {
      await confirmationConfig.onYes();
    });

    await waitFor(() => {
      expect(deletePolicyExpression).toHaveBeenCalledWith('policy-1', 'policy-expression-1');
    });
    expect(updatePolicy).not.toHaveBeenCalled();
    expect(getPolicyExpressions).toHaveBeenCalledTimes(2);
  });

  it('creates a policy statement from the statements toolbar', async () => {
    const user = userEvent.setup();
    const { findByTestId, findByRole, getByRole, getByText, getByTestId } = renderPage();

    await user.click(await findByRole('tab', { name: 'Statements' }));
    await user.click(await findByTestId('policy-statements-add-button'));
    expect(await findByRole('heading', { name: 'Create Statement' })).toBeVisible();

    await user.clear(getByRole('textbox', { name: 'Policy URN' }));
    await user.type(getByRole('textbox', { name: 'Policy URN' }), 'urn:1:telemetry:*');
    await user.click(getByRole('combobox', { name: /Expression/ }));
    await user.click(await findByRole('option', { name: 'Sensitive species' }));
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(updatePolicy).toHaveBeenCalledWith('policy-1', {
        name: 'Sensitive Wildlife Policy',
        description: 'Policy description',
        status: PolicyStatus.APPROVED,
        statements: [
          ...policy.statements,
          {
            effect: 'allow',
            submission_feature_urn: 'urn:1:telemetry:*',
            policy_expression_id: 'policy-expression-1'
          }
        ]
      });
    });

    expect(getByText('urn:1:telemetry:*')).toBeVisible();
  });

  it('creates a policy statement without an expression', async () => {
    const user = userEvent.setup();
    const { findByTestId, findByRole, getByRole, getByTestId } = renderPage();

    await user.click(await findByRole('tab', { name: 'Statements' }));
    await user.click(await findByTestId('policy-statements-add-button'));

    await user.clear(getByRole('textbox', { name: 'Policy URN' }));
    await user.type(getByRole('textbox', { name: 'Policy URN' }), 'urn:1:telemetry:*');
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(updatePolicy).toHaveBeenCalledWith('policy-1', {
        name: 'Sensitive Wildlife Policy',
        description: 'Policy description',
        status: PolicyStatus.APPROVED,
        statements: [
          ...policy.statements,
          {
            effect: 'allow',
            submission_feature_urn: 'urn:1:telemetry:*'
          }
        ]
      });
    });
  });

  it('edits a policy statement from the row actions menu', async () => {
    const user = userEvent.setup();
    const { findByText, findByRole, getByRole, getByTestId } = renderPage();

    await user.click(await findByRole('tab', { name: 'Statements' }));
    await user.click(await findByText('policy-statement-statement-1-menu-Edit'));
    expect(await findByRole('heading', { name: 'Edit Statement' })).toBeVisible();

    await user.clear(getByRole('textbox', { name: 'Policy URN' }));
    await user.type(getByRole('textbox', { name: 'Policy URN' }), 'urn:2:telemetry:*');
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(updatePolicy).toHaveBeenCalledWith('policy-1', {
        name: 'Sensitive Wildlife Policy',
        description: 'Policy description',
        status: PolicyStatus.APPROVED,
        statements: [
          {
            effect: 'allow',
            submission_feature_urn: 'urn:2:telemetry:*',
            policy_expression_id: 'policy-expression-1'
          },
          policy.statements[1]
        ]
      });
    });
  });

  it('deletes a policy statement from the row actions menu after confirmation', async () => {
    const user = userEvent.setup();
    const setYesNoDialog = vi.fn();
    const { findByRole, findByText } = renderPage({ setYesNoDialog });

    await user.click(await findByRole('tab', { name: 'Statements' }));
    await user.click(await findByText('policy-statement-statement-1-menu-Delete'));

    expect(setYesNoDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        dialogTitle: 'Delete Statement',
        dialogText: 'Are you sure you want to delete this policy statement?',
        yesButtonLabel: 'Delete'
      })
    );

    const confirmationConfig = setYesNoDialog.mock.calls[0][0];
    await act(async () => {
      await confirmationConfig.onYes();
    });

    await waitFor(() => {
      expect(updatePolicy).toHaveBeenCalledWith('policy-1', {
        name: 'Sensitive Wildlife Policy',
        description: 'Policy description',
        status: PolicyStatus.APPROVED,
        statements: [policy.statements[1]]
      });
    });
  });
});
