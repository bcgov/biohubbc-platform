import userEvent from '@testing-library/user-event';
import { DialogContext, IDialogContext, defaultSnackbarProps } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { IPolicy, PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { PolicyDetailPage } from './PolicyDetailPage';

vi.mock('hooks/useApi');

type PolicyDetailTestRow = IPolicy['statements'][number] | ITeamPolicyDetails;

vi.mock('components/data-grid/CustomDataGrid', () => ({
  default: ({
    rows,
    columns,
    getRowId,
    'data-testid': dataTestId
  }: {
    rows: PolicyDetailTestRow[];
    columns: { field: string; renderCell?: (params: { row: PolicyDetailTestRow }) => ReactNode }[];
    getRowId?: (row: PolicyDetailTestRow) => string;
    'data-testid'?: string;
  }) => (
    <div data-testid={dataTestId ?? 'policy-statements-table'}>
      {rows.map((row) => (
        <div key={getRowId?.(row) ?? ('policy_statement_id' in row ? row.policy_statement_id : row.team_policy_id)}>
          {columns.map((column) => (
            <div key={column.field}>
              {column.renderCell?.({ row }) ?? String(row[column.field as keyof PolicyDetailTestRow] ?? '')}
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

vi.mock('features/search/result/layout/table/SearchResultTableLayout', () => ({
  SearchResultTableLayout: ({
    results
  }: {
    results: {
      uuid: string;
      submission_name: string;
    }[];
  }) => (
    <div data-testid="policy-feature-results-table">
      {results.map((result) => (
        <div key={result.uuid}>{result.submission_name}</div>
      ))}
    </div>
  )
}));

vi.mock('features/admin/policies/components/PolicyExpression', () => ({
  PolicyExpression: ({
    onChange,
    onValidationChange
  }: {
    onChange?: (value: ExpressionTreeExpression | null) => void;
    onValidationChange?: (error: string | null) => void;
  }) => (
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
  statements: [
    {
      policy_statement_id: 'statement-1',
      policy_id: 'policy-1',
      effect: 'allow',
      submission_feature_urn: 'urn:*:telemetry:*',
      expression
    },
    {
      policy_statement_id: 'statement-2',
      policy_id: 'policy-1',
      effect: 'deny',
      submission_feature_urn: 'urn:*:sample_site:*'
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
          <Route path="/admin/policy/:policyId" element={<PolicyDetailPage />} />
        </Routes>
      </MemoryRouter>
    </DialogContext.Provider>
  );

describe('PolicyDetailPage', () => {
  const getPolicy = vi.fn();
  const updatePolicy = vi.fn();
  const updatePolicyStatus = vi.fn();
  const searchFeatures = vi.fn();
  const getTeamPolicies = vi.fn();

  beforeEach(() => {
    getPolicy.mockReset();
    updatePolicy.mockReset();
    updatePolicyStatus.mockReset();
    searchFeatures.mockReset();
    getTeamPolicies.mockReset();

    getPolicy.mockResolvedValue(policy);
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
          expression
        }
      ]
    });
    searchFeatures.mockResolvedValue({
      features: [
        {
          submission_feature_id: 1,
          submission_id: 1,
          uuid: 'feature-1',
          feature_type_id: 1,
          feature_type_name: 'telemetry',
          properties: {},
          submission_name: 'Telemetry Feature One',
          is_secured: false,
          relevancy_score: 1,
          create_date: '2026-06-23T00:00:00.000Z'
        }
      ],
      properties: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      }
    });
    getTeamPolicies.mockResolvedValue({
      team_policies: [
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
        updatePolicy,
        updatePolicyStatus
      },
      search: {
        searchFeatures
      },
      teamPolicies: {
        getTeamPolicies
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
      expect(getByRole('tab', { name: 'Features' })).toBeVisible();
      expect(getByRole('tab', { name: 'Teams' })).toBeVisible();
      expect(getByTestId('policy-expressions-table')).toBeVisible();
      expect(getByText('urn:*:telemetry:*')).toBeVisible();
      expect(getByText(/"operator":"Equals"/)).toBeVisible();
    });
  });

  it('renders the statements section from the statements tab', async () => {
    const user = userEvent.setup();
    const { findByRole, findByTestId, getByText } = renderPage();

    await user.click(await findByRole('tab', { name: 'Statements' }));

    expect(await findByTestId('policy-statements-table')).toBeVisible();
    expect(getByText('urn:*:telemetry:*')).toBeVisible();
    expect(getByText('urn:*:sample_site:*')).toBeVisible();
  });

  it('shows the policy skeleton while loading and no policy is available', async () => {
    getPolicy.mockReturnValue(new Promise(() => undefined));

    const { findByTestId } = renderPage();

    expect(await findByTestId('policy-skeleton')).toBeVisible();
  });

  it('renders feature search results for policy statement expressions', async () => {
    const user = userEvent.setup();
    const { findByRole, findByTestId, getByText } = renderPage();

    await user.click(await findByRole('tab', { name: 'Features' }));

    expect(await findByTestId('policy-feature-results-table')).toBeVisible();
    expect(getByText('Telemetry Feature One')).toBeVisible();
    expect(searchFeatures).toHaveBeenCalledWith('telemetry', expression, { page: 1, limit: 10 });
  });

  it('renders teams with access to the policy', async () => {
    const user = userEvent.setup();
    const { findByRole, findByTestId, getByText } = renderPage();

    await user.click(await findByRole('tab', { name: 'Teams' }));

    expect(await findByTestId('policy-teams-table')).toBeVisible();
    expect(getByText('Team Alpha')).toBeVisible();

    await waitFor(() => {
      expect(getTeamPolicies).toHaveBeenCalledWith(
        { policyIds: ['policy-1'] },
        { page: 1, limit: 10, sort: 'team_name', order: 'asc' }
      );
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
        statements: [
          {
            effect: 'allow',
            submission_feature_urn: 'urn:*:telemetry:*',
            expression
          },
          {
            effect: 'deny',
            submission_feature_urn: 'urn:*:sample_site:*'
          }
        ]
      });
    });
    expect(getByRole('heading', { name: 'Updated Policy' })).toBeVisible();
  });

  it('creates a policy expression from the expressions toolbar', async () => {
    const user = userEvent.setup();
    const { findByTestId, findByRole, getByRole, getByText, getByTestId } = renderPage();

    await user.click(await findByTestId('policy-expressions-add-button'));
    expect(await findByRole('heading', { name: 'Create Expression' })).toBeVisible();

    await user.clear(getByRole('textbox', { name: 'Policy URN' }));
    await user.type(getByRole('textbox', { name: 'Policy URN' }), 'urn:3:telemetry:*');
    await user.click(getByText('Set expression'));
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(updatePolicy).toHaveBeenCalledWith('policy-1', {
        name: 'Sensitive Wildlife Policy',
        description: 'Policy description',
        status: PolicyStatus.APPROVED,
        statements: [
          {
            effect: 'allow',
            submission_feature_urn: 'urn:*:telemetry:*',
            expression
          },
          {
            effect: 'deny',
            submission_feature_urn: 'urn:*:sample_site:*'
          },
          {
            effect: 'allow',
            submission_feature_urn: 'urn:3:telemetry:*',
            expression
          }
        ]
      });
    });
  });

  it('creates a policy statement from the statements toolbar', async () => {
    const user = userEvent.setup();
    const { findByTestId, findByRole, getByRole, getByText, getByTestId } = renderPage();

    await user.click(await findByRole('tab', { name: 'Statements' }));
    await user.click(await findByTestId('policy-statements-add-button'));
    expect(await findByRole('heading', { name: 'Create Statement' })).toBeVisible();

    await user.clear(getByRole('textbox', { name: 'Policy URN' }));
    await user.type(getByRole('textbox', { name: 'Policy URN' }), 'urn:1:telemetry:*');
    await user.click(getByText('Set expression'));
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(updatePolicy).toHaveBeenCalledWith('policy-1', {
        name: 'Sensitive Wildlife Policy',
        description: 'Policy description',
        status: PolicyStatus.APPROVED,
        statements: [
          {
            effect: 'allow',
            submission_feature_urn: 'urn:*:telemetry:*',
            expression
          },
          {
            effect: 'deny',
            submission_feature_urn: 'urn:*:sample_site:*'
          },
          {
            effect: 'allow',
            submission_feature_urn: 'urn:1:telemetry:*',
            expression
          }
        ]
      });
    });

    expect(getByText('urn:1:telemetry:*')).toBeVisible();
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
            expression
          },
          {
            effect: 'deny',
            submission_feature_urn: 'urn:*:sample_site:*'
          }
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
        statements: [
          {
            effect: 'deny',
            submission_feature_urn: 'urn:*:sample_site:*'
          }
        ]
      });
    });
  });
});
