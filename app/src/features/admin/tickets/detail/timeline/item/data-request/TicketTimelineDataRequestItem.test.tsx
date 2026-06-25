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
  const onViewPolicy = vi.fn();
  const onViewFinalizedPolicy = vi.fn();
  const onApprove = vi.fn();
  const onDeny = vi.fn();
  const onResetToReviewed = vi.fn();

  render(
    <TicketTimelineDataRequestItem
      dataRequest={{ ...baseDataRequest, status }}
      dateLabel="a few seconds ago"
      isUpdating={isUpdating}
      onViewPolicy={onViewPolicy}
      onViewFinalizedPolicy={onViewFinalizedPolicy}
      onApprove={onApprove}
      onDeny={onDeny}
      onResetToReviewed={onResetToReviewed}
    />
  );

  return { onViewPolicy, onViewFinalizedPolicy, onApprove, onDeny, onResetToReviewed };
};

describe('TicketTimelineDataRequestItem', () => {
  it('shows only Review Policy when status is requested', () => {
    renderComponent(PolicyStatus.REQUESTED);

    expect(screen.getByRole('button', { name: 'Review Policy' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'View Policy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Requested' })).not.toBeInTheDocument();
  });

  it('calls onViewFinalizedPolicy when Review Policy is clicked from requested state', async () => {
    const user = userEvent.setup();
    const { onViewFinalizedPolicy, onViewPolicy } = renderComponent(PolicyStatus.REQUESTED);

    await user.click(screen.getByRole('button', { name: 'Review Policy' }));

    expect(onViewFinalizedPolicy).toHaveBeenCalledWith(baseDataRequest.data_request_id, baseDataRequest.policy_id);
    expect(onViewPolicy).not.toHaveBeenCalled();
  });

  it('shows View + Approve + Deny when status is not requested/finalized', () => {
    renderComponent(PolicyStatus.REVIEWED);

    expect(screen.getByRole('button', { name: 'View Policy' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Deny' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Review Policy' })).not.toBeInTheDocument();
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
          onViewPolicy={vi.fn()}
          onViewFinalizedPolicy={vi.fn()}
          onApprove={vi.fn()}
          onDeny={vi.fn()}
          onResetToReviewed={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: label })).toBeVisible();
      expect(screen.getByRole('button', { name: 'View Policy' })).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Review Policy' })).not.toBeInTheDocument();

      unmount();
    }
  });

  it('calls onResetToReviewed when finalized status button is clicked', async () => {
    const user = userEvent.setup();
    const { onResetToReviewed } = renderComponent(PolicyStatus.APPROVED);

    await user.click(screen.getByRole('button', { name: 'Approved' }));

    expect(onResetToReviewed).toHaveBeenCalledWith(baseDataRequest.data_request_id);
  });

  it('calls onViewFinalizedPolicy when View Policy is clicked for finalized statuses', async () => {
    const user = userEvent.setup();
    const { onViewFinalizedPolicy } = renderComponent(PolicyStatus.DENIED);

    await user.click(screen.getByRole('button', { name: 'View Policy' }));

    expect(onViewFinalizedPolicy).toHaveBeenCalledWith(baseDataRequest.data_request_id, baseDataRequest.policy_id);
  });
});
