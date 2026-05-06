import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { render } from 'test-helpers/test-utils';
import { TicketTimelineCommentItem } from './TicketTimelineCommentItem';

describe('TicketTimelineCommentItem', () => {
  it('renders comment markdown using shared markdown renderer', () => {
    const artifacts: ITicketArtifact[] = [
      {
        ticket_artifact_id: '05c4063e-a344-42a6-89f8-b15161789cda',
        ticket_id: '22222222-2222-4222-8222-222222222222',
        artifact_id: '11111111-1111-4111-8111-111111111111',
        record_end_date: null,
        create_date: '2026-02-25T00:00:00.000Z',
        key: 'generate.py'
      }
    ];

    render(
      <TicketTimelineCommentItem
        ticketCommentId="comment-1"
        author="Sarah"
        comment={
          '# Update\n\n**Done** with `step-1`. Look at [the script](/artifact/05c4063e-a344-42a6-89f8-b15161789cda).'
        }
        artifacts={artifacts}
        dateLabel="1 minute ago"
      />
    );

    expect(screen.getByText('Sarah')).toBeVisible();
    expect(screen.getByText('1 minute ago')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Update' })).toBeVisible();
    expect(screen.getByText('Done', { selector: 'strong' })).toBeVisible();
    expect(screen.getByText('step-1', { selector: 'code' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'generate.py' })).not.toHaveAttribute('href');
    expect(screen.queryByLabelText('Remove staged artifact generate.py')).not.toBeInTheDocument();
    expect(screen.queryByText('# Update')).not.toBeInTheDocument();
  });

  it('renders edit and delete context menu actions', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <TicketTimelineCommentItem
        ticketCommentId="comment-1"
        author="Sarah"
        comment="A comment"
        artifacts={[]}
        dateLabel="1 minute ago"
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: 'ticket-comment-comment-1-menu' }));

    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();

    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith('comment-1');

    await user.click(screen.getByRole('button', { name: 'ticket-comment-comment-1-menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('comment-1');
  });
});
