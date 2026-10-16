import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DialogContextProvider } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { DataRequestListItem } from 'interfaces/useDataRequestApi.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminDataRequestDecisionActions } from './AdminDataRequestDecisionActions';

vi.mock('hooks/useApi');

const mockUseApi = {
  policies: {
    updatePolicyStatus: vi.fn()
  }
};

const dataRequest: DataRequestListItem = {
  data_request_id: 'request-1',
  reason: 'Moose telemetry for a habitat study',
  status: PolicyStatus.REVIEWED,
  create_date: '2026-01-05T12:00:00.000Z',
  requested_by: 42,
  requested_by_name: 'Robin Biologist',
  ticket_id: 'ticket-1',
  policy_id: 'policy-1'
};

const renderActions = (status: PolicyStatus) => {
  return render(
    <DialogContextProvider>
      <AdminDataRequestDecisionActions dataRequest={{ ...dataRequest, status }} />
    </DialogContextProvider>
  );
};

describe('AdminDataRequestDecisionActions', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.policies.updatePolicyStatus.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each([PolicyStatus.REQUESTED, PolicyStatus.REVIEWED])('offers Approve and Deny while %s', (status) => {
    renderActions(status);

    expect(screen.getByRole('button', { name: 'Approve' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Deny' })).toBeVisible();
    expect(screen.queryByTestId('data-request-decision-button')).not.toBeInTheDocument();
  });

  it('approves the request only after confirmation', async () => {
    renderActions(PolicyStatus.REVIEWED);

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Are you sure you want to approve this data request?')).toBeVisible();
    expect(mockUseApi.policies.updatePolicyStatus).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(mockUseApi.policies.updatePolicyStatus).toHaveBeenCalledWith('policy-1', {
        status: PolicyStatus.APPROVED
      });
    });
  });

  it('does not change the request when the confirmation is cancelled', async () => {
    renderActions(PolicyStatus.REVIEWED);

    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(mockUseApi.policies.updatePolicyStatus).not.toHaveBeenCalled();
  });

  it('denies the request after confirmation', async () => {
    renderActions(PolicyStatus.REQUESTED);

    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deny' }));

    await waitFor(() => {
      expect(mockUseApi.policies.updatePolicyStatus).toHaveBeenCalledWith('policy-1', { status: PolicyStatus.DENIED });
    });
  });

  it.each([
    [PolicyStatus.APPROVED, 'Approved'],
    [PolicyStatus.DENIED, 'Denied']
  ])('shows a decided request as %s and resets it to reviewed after confirmation', async (status, label) => {
    renderActions(status);

    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: label }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes' }));

    await waitFor(() => {
      expect(mockUseApi.policies.updatePolicyStatus).toHaveBeenCalledWith('policy-1', {
        status: PolicyStatus.REVIEWED
      });
    });
  });
});
