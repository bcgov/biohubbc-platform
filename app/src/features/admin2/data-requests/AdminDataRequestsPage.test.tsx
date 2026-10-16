import { cleanup, fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminDataRequestsPage } from './AdminDataRequestsPage';

vi.mock('hooks/useApi');

const mockUseApi = {
  dataRequest: {
    getDataRequests: vi.fn()
  },
  policies: {
    getPolicies: vi.fn()
  }
};

const renderContainer = (route: string) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/admin/data-requests" element={<AdminDataRequestsPage />} />
        <Route path="/admin/data-requests/:dataRequestId" element={<div data-testid="data-request-page" />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AdminDataRequestsPage', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.dataRequest.getDataRequests.mockResolvedValue({
      data_requests: [
        {
          data_request_id: 'request-1',
          reason: 'Moose telemetry for a habitat study',
          status: PolicyStatus.APPROVED,
          create_date: '2026-01-05T12:00:00.000Z',
          requested_by: 42,
          requested_by_name: 'Robin Biologist',
          ticket_id: 'ticket-1',
          policy_id: 'policy-1'
        }
      ],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
    mockUseApi.policies.getPolicies.mockResolvedValue({
      policies: [
        {
          policy_id: 'policy-1',
          name: 'Moose telemetry policy',
          description: null,
          status: PolicyStatus.APPROVED,
          statements: [],
          expressions: []
        }
      ],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens on the Requests tab with each request's description, decision, date and submitter", async () => {
    const { getByRole, getAllByRole, findByText, getByText } = renderContainer('/admin/data-requests');

    expect(getByRole('heading', { level: 1, name: 'Data Requests' })).toBeVisible();
    expect(getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Requests', 'Policies']);
    expect(getByRole('tab', { name: 'Requests' })).toHaveAttribute('aria-selected', 'true');

    expect(await findByText('Moose telemetry for a habitat study')).toBeVisible();
    expect(getByText('Approved')).toBeVisible();
    expect(getByText('Jan 5, 2026')).toBeVisible();
    expect(getByText('Robin Biologist')).toBeVisible();
    expect(mockUseApi.policies.getPolicies).not.toHaveBeenCalled();
  });

  it('opens the data request page when a request is clicked', async () => {
    const { findByText, findByTestId } = renderContainer('/admin/data-requests');

    fireEvent.click(await findByText('Moose telemetry for a habitat study'));

    expect(await findByTestId('data-request-page')).toBeVisible();
  });

  it('shows the policies when the Policies tab is selected', async () => {
    const { getByRole, getAllByRole, getByText, findByText, queryByText } = renderContainer('/admin/data-requests');

    fireEvent.click(getByRole('tab', { name: 'Policies' }));

    expect(await findByText('Moose telemetry policy')).toBeVisible();
    expect(queryByText('Moose telemetry for a habitat study')).not.toBeInTheDocument();
    expect(getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Name',
      'Status',
      'End Date',
      'Actions'
    ]);
    expect(getByText('Approved')).toBeVisible();
  });

  it('opens the tab named in the URL', async () => {
    const { getByRole, findByText } = renderContainer('/admin/data-requests?tab=policies');

    expect(getByRole('tab', { name: 'Policies' })).toHaveAttribute('aria-selected', 'true');
    expect(await findByText('Moose telemetry policy')).toBeVisible();
    expect(mockUseApi.dataRequest.getDataRequests).not.toHaveBeenCalled();
  });
});
