import { screen, within } from '@testing-library/react';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { render } from 'test-helpers/test-utils';
import { TicketMarkdownContent } from './TicketMarkdownContent';

const ticketArtifact = (
  artifact: Pick<ITicketArtifact, 'ticket_artifact_id' | 'artifact_id' | 'object_key'>
): ITicketArtifact => ({
  ticket_id: '22222222-2222-4222-8222-222222222222',
  record_end_date: null,
  create_date: '2026-02-25T00:00:00.000Z',
  ...artifact
});

describe('TicketMarkdownContent', () => {
  it('passes root Box props to the markdown container', () => {
    render(<TicketMarkdownContent content="Ticket comment" data-testid="ticket-markdown-root" sx={{ mt: 1 }} />);

    expect(screen.getByTestId('ticket-markdown-root')).toHaveTextContent('Ticket comment');
  });

  it('updates artifact link resolution when the artifacts prop changes', () => {
    const { rerender } = render(
      <TicketMarkdownContent content="[3ea79946-8cf2-4792-9239-5b148f9f95eb](/artifact/3ea79946-8cf2-4792-9239-5b148f9f95eb)" />
    );

    expect(screen.getByText('File not found')).toBeVisible();

    rerender(
      <TicketMarkdownContent
        content="[3ea79946-8cf2-4792-9239-5b148f9f95eb](/artifact/3ea79946-8cf2-4792-9239-5b148f9f95eb)"
        artifacts={[
          ticketArtifact({
            ticket_artifact_id: '3ea79946-8cf2-4792-9239-5b148f9f95eb',
            artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
            object_key: 'tickets/ticket-id/upload/upload-id/report.pdf'
          })
        ]}
      />
    );

    expect(screen.queryByText('File not found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3ea79946-8cf2-4792-9239-5b148f9f95eb' })).not.toHaveAttribute('href');
  });

  it('scopes artifact lookup to the current component instance', () => {
    const artifact = ticketArtifact({
      ticket_artifact_id: '3ea79946-8cf2-4792-9239-5b148f9f95eb',
      artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
      object_key: 'tickets/ticket-id/upload/upload-id/report.pdf'
    });

    render(
      <>
        <TicketMarkdownContent
          content="[first](/artifact/3ea79946-8cf2-4792-9239-5b148f9f95eb)"
          artifacts={[artifact]}
          data-testid="first-markdown"
        />
        <TicketMarkdownContent
          content="[second](/artifact/3ea79946-8cf2-4792-9239-5b148f9f95eb)"
          data-testid="second-markdown"
        />
      </>
    );

    expect(within(screen.getByTestId('first-markdown')).getByRole('button', { name: 'first' })).toBeVisible();
    expect(within(screen.getByTestId('second-markdown')).getByText('File not found')).toBeVisible();
    expect(
      within(screen.getByTestId('second-markdown')).queryByRole('button', { name: 'second' })
    ).not.toBeInTheDocument();
  });
});
