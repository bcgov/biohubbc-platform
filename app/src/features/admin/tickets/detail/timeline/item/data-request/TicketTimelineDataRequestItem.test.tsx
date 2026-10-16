import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { render } from 'test-helpers/test-utils';
import { TicketTimelineDataRequestItem } from './TicketTimelineDataRequestItem';

const baseDataRequest = {
  data_request_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  reason: 'Need access to data',
  team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  requested_by: 1,
  ticket_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  policy_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  create_date: '2026-03-01T00:00:00.000Z'
};

const renderComponent = (status: PolicyStatus, isUpdating = false) => {
  const onViewRequest = vi.fn();
  const onApprove = vi.fn();
  const onDeny = vi.fn();
  const onResetToReviewed = vi.fn();

  render(
    <TicketTimelineDataRequestItem
      dataRequest={{ ...baseDataRequest, status }}
      dateLabel="a few seconds ago"
      isUpdating={isUpdating}
      onViewRequest={onViewRequest}
      onApprove={onApprove}
      onDeny={onDeny}
      onResetToReviewed={onResetToReviewed}
    />
  );

  return { onViewRequest, onApprove, onDeny, onResetToReviewed };
};

describe('TicketTimelineDataRequestItem', () => {
  it('shows only Review Request when status is requested', () => {
    renderComponent(PolicyStatus.REQUESTED);

    expect(screen.getByRole('button', { name: 'Review Request' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'View Policy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Requested' })).not.toBeInTheDocument();
  });

  it('calls onViewRequest with the data request when Review Request is clicked from requested state', async () => {
    const user = userEvent.setup();
    const { onViewRequest } = renderComponent(PolicyStatus.REQUESTED);

    await user.click(screen.getByRole('button', { name: 'Review Request' }));

    expect(onViewRequest).toHaveBeenCalledWith(baseDataRequest.data_request_id);
  });

  it('shows View + Approve + Deny when status is not requested/finalized', () => {
    renderComponent(PolicyStatus.REVIEWED);

    expect(screen.getByRole('button', { name: 'View Request' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'View Policy' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Deny' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Review Request' })).not.toBeInTheDocument();
  });

  it('shows finalized button only for approved/denied', () => {
    for (const [status, label] of [
      [PolicyStatus.APPROVED, 'Approved'],
      [PolicyStatus.DENIED, 'Denied']
    ] as const) {
      const { unmount } = render(
        <TicketTimelineDataRequestItem
          dataRequest={{ ...baseDataRequest, status }}
          dateLabel="a few seconds ago"
          isUpdating={false}
          onViewRequest={vi.fn()}
          onApprove={vi.fn()}
          onDeny={vi.fn()}
          onResetToReviewed={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: label })).toBeVisible();
      expect(screen.getByRole('button', { name: 'View Request' })).toBeVisible();
      expect(screen.queryByRole('button', { name: 'View Policy' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Review Request' })).not.toBeInTheDocument();

      unmount();
    }
  });

  it('calls onResetToReviewed when finalized status button is clicked', async () => {
    const user = userEvent.setup();
    const { onResetToReviewed } = renderComponent(PolicyStatus.APPROVED);

    await user.click(screen.getByRole('button', { name: 'Approved' }));

    expect(onResetToReviewed).toHaveBeenCalledWith(baseDataRequest.data_request_id);
  });

  it('calls onViewRequest with the data request when View Request is clicked for finalized statuses', async () => {
    const user = userEvent.setup();
    const { onViewRequest } = renderComponent(PolicyStatus.DENIED);

    await user.click(screen.getByRole('button', { name: 'View Request' }));

    expect(onViewRequest).toHaveBeenCalledWith(baseDataRequest.data_request_id);
  });
});
