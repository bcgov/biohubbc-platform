import { cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { AxiosError, AxiosResponse } from 'axios';
import { SYSTEM_ROLE } from 'constants/roles';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminDataRequestPage } from './AdminDataRequestPage';

vi.mock('hooks/useApi');
vi.mock('hooks/useAuthStateContext');

const expression = { type: 'expression', operator: 'AND', clauses: [] };

const mockUseApi = {
  dataRequest: {
    getDataRequest: vi.fn(),
    getDataRequestFeatureTypes: vi.fn(),
    getDataRequestRecipients: vi.fn()
  },
  policies: {
    getPolicy: vi.fn()
  },
  search: {
    countFeatures: vi.fn()
  }
};

const FeatureTypePage = () => {
  const { featureType } = useParams();

  return <div data-testid="feature-type-page">{featureType}</div>;
};

const renderContainer = (route: string) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/admin/data-requests/:dataRequestId" element={<AdminDataRequestPage />} />
        <Route path="/admin/data-requests/:dataRequestId/feature-types/:featureType" element={<FeatureTypePage />} />
        <Route path="/page-not-found" element={<div data-testid="not-found-page" />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AdminDataRequestPage', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    (useAuthStateContext as Mock).mockReturnValue({ biohubUserWrapper: { roleNames: [SYSTEM_ROLE.SYSTEM_ADMIN] } });
    mockUseApi.dataRequest.getDataRequest.mockResolvedValue({
      data_request_id: 'request-1',
      reason: 'Moose telemetry for a habitat study',
      status: PolicyStatus.APPROVED,
      create_date: '2026-01-05T12:00:00.000Z',
      requested_by: 42,
      requested_by_name: 'Robin Biologist',
      ticket_id: 'ticket-1',
      policy_id: 'policy-1'
    });
    mockUseApi.dataRequest.getDataRequestFeatureTypes.mockResolvedValue({
      feature_types: [{ feature_type_name: 'telemetry', expression }]
    });
    mockUseApi.search.countFeatures.mockResolvedValue({ total: 7 });
    mockUseApi.policies.getPolicy.mockResolvedValue({
      policy_id: 'policy-1',
      name: 'Moose telemetry policy',
      description: 'Access for the habitat study',
      status: PolicyStatus.APPROVED,
      statements: [
        {
          policy_statement_id: 'statement-1',
          policy_id: 'policy-1',
          effect: 'allow',
          submission_feature_urn: 'urn:*:telemetry:*',
          policy_expression_id: 'policy-expression-1'
        }
      ],
      expressions: [
        {
          policy_expression_id: 'policy-expression-1',
          policy_id: 'policy-1',
          expression_id: 'expression-1',
          name: null,
          description: null,
          expression
        }
      ]
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens on Details with the feature types the request asks for, and opens one when clicked', async () => {
    const { getByRole, getAllByRole, findByRole, findByTestId } = renderContainer('/admin/data-requests/request-1');

    expect(getByRole('heading', { level: 1, name: 'Data Request' })).toBeVisible();
    expect(getByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/admin');
    expect(getByRole('link', { name: 'Data Requests' })).toHaveAttribute('href', '/admin/data-requests');
    expect(within(getByRole('navigation', { name: 'data request breadcrumb' })).getByText('request-1')).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Details', 'Recipients', 'Policy', 'About']);
    expect(getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');

    expect(await findByRole('heading', { name: 'Requested Features (1)' })).toBeVisible();
    expect(getByRole('heading', { name: 'Details' })).toBeVisible();
    expect(getByRole('row', { name: 'Reason Moose telemetry for a habitat study' })).toBeVisible();
    expect(getByRole('row', { name: 'Requested By Robin Biologist' })).toBeVisible();
    expect(mockUseApi.dataRequest.getDataRequest).toHaveBeenCalledWith('request-1', expect.anything());
    expect(mockUseApi.dataRequest.getDataRequestFeatureTypes).toHaveBeenCalledWith('request-1', expect.anything());
    expect(mockUseApi.policies.getPolicy).not.toHaveBeenCalled();
    expect(getByRole('link', { name: 'Open Ticket' })).toHaveAttribute('href', '/admin/tickets/ticket-1');

    fireEvent.click(await findByRole('gridcell', { name: 'Telemetry' }));

    expect(await findByTestId('feature-type-page')).toHaveTextContent('telemetry');
  });

  it('offers the policy when the request names no feature type', async () => {
    mockUseApi.dataRequest.getDataRequestFeatureTypes.mockResolvedValue({ feature_types: [] });

    const { findByText, getByRole } = renderContainer('/admin/data-requests/request-1');

    expect(await findByText('No data has been requested yet')).toBeVisible();
    expect(getByRole('link', { name: 'Manage Policy' })).toHaveAttribute('href', '/admin/policy/policy-1');
    expect(mockUseApi.search.countFeatures).not.toHaveBeenCalled();
  });

  it('marks which requested feature types have data', async () => {
    mockUseApi.dataRequest.getDataRequestFeatureTypes.mockResolvedValue({
      feature_types: [
        { feature_type_name: 'telemetry', expression },
        { feature_type_name: 'observation', expression: null }
      ]
    });
    mockUseApi.search.countFeatures.mockImplementation(async (featureType: string) => ({
      total: featureType === 'telemetry' ? 7 : 0
    }));

    const { findByRole, getAllByRole } = renderContainer('/admin/data-requests/request-1');

    expect(await findByRole('heading', { name: 'Requested Features (2)' })).toBeVisible();

    await waitFor(async () => {
      expect(getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Feature Type', 'Data']);
      expect(within(await findByRole('row', { name: /^Telemetry/ })).getByTitle('Has data')).toBeInTheDocument();
      expect(within(await findByRole('row', { name: /^Observation/ })).getByTitle('No data')).toBeInTheDocument();
    });

    expect(mockUseApi.search.countFeatures).toHaveBeenCalledWith('telemetry', expression, expect.anything());
    expect(mockUseApi.search.countFeatures).toHaveBeenCalledWith('observation', null, expect.anything());
  });

  it('lists the recipients of the data request in the Recipients tab', async () => {
    mockUseApi.dataRequest.getDataRequestRecipients.mockResolvedValue({
      recipients: [
        {
          system_user_id: 42,
          user_identifier: 'rbiologist',
          display_name: 'Biologist, Robin',
          email: 'robin@example.com'
        }
      ]
    });

    const { getByRole, findByRole, findByText, getByText } = renderContainer(
      '/admin/data-requests/request-1?tab=recipients'
    );

    expect(await findByRole('heading', { name: 'Recipients (1)' })).toBeVisible();
    expect(getByRole('tab', { name: 'Recipients' })).toHaveAttribute('aria-selected', 'true');
    expect(await findByText('Biologist, Robin')).toBeVisible();
    expect(getByText('rbiologist')).toBeVisible();
    expect(getByText('robin@example.com')).toBeVisible();
    expect(mockUseApi.dataRequest.getDataRequestRecipients).toHaveBeenCalledWith('request-1', expect.anything());
  });

  it('shows the policy of the data request in the Policy tab', async () => {
    const { getByRole, findByText, findByRole, queryByRole } = renderContainer('/admin/data-requests/request-1');

    fireEvent.click(getByRole('tab', { name: 'Policy' }));

    expect(await findByRole('row', { name: 'Name Moose telemetry policy' })).toBeVisible();
    expect(queryByRole('link', { name: 'Moose telemetry policy' })).not.toBeInTheDocument();
    expect(await findByText('Access for the habitat study')).toBeVisible();
    expect(getByRole('link', { name: 'Open Policy' })).toHaveAttribute('href', '/admin/policy/policy-1');
    expect(await findByText('allow: urn:*:telemetry:*')).toBeVisible();
    expect(mockUseApi.policies.getPolicy).toHaveBeenCalledWith('policy-1', expect.anything());
  });

  it('shows the decision, date and ID in the About tab, without what the Details tab already shows', async () => {
    const { getByRole, findByText } = renderContainer('/admin/data-requests/request-1?tab=about');

    expect(await findByText('Submitted Date')).toBeVisible();

    const about = within(getByRole('tabpanel', { name: 'About' }));
    expect(about.getByText('Approved')).toBeVisible();
    expect(about.queryByText('Moose telemetry for a habitat study')).not.toBeInTheDocument();
    expect(about.queryByText('Robin Biologist')).not.toBeInTheDocument();
    expect(about.getByText('Submitted Date')).toBeVisible();
    expect(about.getByText(/Jan 5, 2026/)).toBeVisible();
    expect(about.getByText('request-1')).toBeVisible();
  });

  it.each([400, 404])('redirects to not found when the API answers %s', async (status) => {
    mockUseApi.dataRequest.getDataRequest.mockRejectedValue(
      new AxiosError('Not found', String(status), undefined, undefined, { status } as AxiosResponse)
    );

    const { getByTestId } = renderContainer('/admin/data-requests/missing');

    await waitFor(() => {
      expect(getByTestId('not-found-page')).toBeVisible();
    });
  });
});
