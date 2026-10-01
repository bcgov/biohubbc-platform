import { fireEvent, render, screen } from 'test-helpers/test-utils';
import { TicketSidebarSystemUserCard } from './TicketSidebarSystemUserCard';

it('disables assignee actions until the server returns a real assignment ID', () => {
  const onRemove = vi.fn();
  const onUpdate = vi.fn();
  render(
    <TicketSidebarSystemUserCard
      ticketSystemUser={{
        ticket_system_user_id: 'optimistic-1',
        ticket_id: 'ticket',
        system_user_id: 1,
        status: 'requested',
        system_user: { system_user_id: 1, display_name: 'Sarah', user_identifier: 'sarah', email: null }
      }}
      onRemoveTicketSystemUser={onRemove}
      onUpdateTicketSystemUserStatus={onUpdate}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'ticket-system-user-optimistic-1-menu' }));
  for (const item of screen.getAllByRole('menuitem')) {
    expect(item).toHaveAttribute('aria-disabled', 'true');
  }
  expect(onRemove).not.toHaveBeenCalled();
  expect(onUpdate).not.toHaveBeenCalled();
});
