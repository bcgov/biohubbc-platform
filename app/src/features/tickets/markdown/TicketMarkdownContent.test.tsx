import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { render } from 'test-helpers/test-utils';
import { TicketMarkdownContent } from './TicketMarkdownContent/components/TicketMarkdownContent';

const ticketArtifact = (
  artifact: Pick<ITicketArtifact, 'ticket_artifact_id' | 'artifact_id' | 'key'>
): ITicketArtifact => ({
  ticket_id: '22222222-2222-4222-8222-222222222222',
  record_end_date: null,
  create_date: '2026-02-25T00:00:00.000Z',
  ...artifact
});

describe('TicketMarkdownContent', () => {
  it('renders supported markdown elements with shared typography', () => {
    render(
      <TicketMarkdownContent
        content={[
          '# Heading',
          '',
          'Paragraph with **bold**, *italic*, and `inline code`.',
          '',
          '- First bullet',
          '- Second bullet',
          '',
          '1. First ordered',
          '2. Second ordered',
          '',
          '[artifact link](/artifact/550e8400-e29b-41d4-a716-446655440000)',
          '',
          '[external link](https://example.com)'
        ].join('\n')}
      />
    );

    expect(screen.getByRole('heading', { name: 'Heading' })).toBeVisible();
    expect(screen.getByText('bold', { selector: 'strong' })).toBeVisible();
    expect(screen.getByText('italic', { selector: 'em' })).toBeVisible();
    expect(screen.getByText('inline code', { selector: 'code' })).toBeVisible();
    expect(screen.getByText('First bullet')).toBeVisible();
    expect(screen.getByText('Second bullet')).toBeVisible();
    expect(screen.getByText('First ordered')).toBeVisible();
    expect(screen.getByText('Second ordered')).toBeVisible();

    expect(screen.getByText('File not found')).toBeVisible();
    expect(screen.getByRole('link', { name: 'external link' })).toHaveAttribute('href', 'https://example.com');
  });

  it('renders schemeless markdown links with the provided href and no HTTP icon', () => {
    render(<TicketMarkdownContent content="You can [Google](google.ca) it." />);

    expect(screen.getByRole('link', { name: 'Google' })).toHaveAttribute('href', 'google.ca');
  });

  it('renders known artifact path links with the artifact filename', () => {
    render(
      <TicketMarkdownContent
        content="Look at [generate.py](/artifact/90b6df74-1b23-4064-ad62-f83c291d31d2), thanks"
        artifacts={[
          ticketArtifact({
            ticket_artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
            artifact_id: '11111111-1111-4111-8111-111111111111',
            key: 'tickets/ticket-id/upload/upload-id/generate.py'
          })
        ]}
      />
    );

    expect(screen.getByRole('button', { name: 'generate.py' })).not.toHaveAttribute('href');
  });

  it('renders missing artifact path links as disabled file-not-found text', () => {
    render(<TicketMarkdownContent content="[unknown file](/artifact/90b6df74-1b23-4064-ad62-f83c291d31d2)" />);

    expect(screen.getByText('File not found')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'unknown file' })).not.toBeInTheDocument();
  });

  it('renders malformed artifact path links as disabled file-not-found text', () => {
    render(<TicketMarkdownContent content="[generate.py](/artifact/f7ff5215-ce89-427a-b054-5a8cd67f0fb)" />);

    expect(screen.getByText('File not found')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'generate.py' })).not.toBeInTheDocument();
  });

  it('keeps the markdown label when artifact metadata has a UUID key', () => {
    render(
      <TicketMarkdownContent
        content="[generate.py](/artifact/90b6df74-1b23-4064-ad62-f83c291d31d2)"
        artifacts={[
          ticketArtifact({
            ticket_artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
            artifact_id: '11111111-1111-4111-8111-111111111111',
            key: '2612e2f6-f561-4115-b0d9-96db34b11738'
          })
        ]}
      />
    );

    expect(screen.getByRole('button', { name: 'generate.py' })).not.toHaveAttribute('href');
    expect(screen.queryByText('2612e2f6-f561-4115-b0d9-96db34b11738')).not.toBeInTheDocument();
  });

  it('delegates known artifact link clicks to the artifact handler', async () => {
    const user = userEvent.setup();
    const handleArtifactClick = vi.fn().mockResolvedValue(undefined);
    const artifact = ticketArtifact({
      ticket_artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
      artifact_id: '11111111-1111-4111-8111-111111111111',
      key: 'tickets/ticket-id/upload/upload-id/generate.py'
    });

    render(
      <TicketMarkdownContent
        content="[generate.py](/artifact/90b6df74-1b23-4064-ad62-f83c291d31d2)"
        artifacts={[artifact]}
        onArtifactLinkClick={handleArtifactClick}
      />
    );

    await user.click(screen.getByRole('button', { name: 'generate.py' }));

    expect(handleArtifactClick).toHaveBeenCalledWith(artifact);
  });

  it('uses the ticket artifact key when artifact link text is a UUID', () => {
    render(
      <TicketMarkdownContent
        content="[3ea79946-8cf2-4792-9239-5b148f9f95eb](/artifact/3ea79946-8cf2-4792-9239-5b148f9f95eb)"
        artifacts={[
          ticketArtifact({
            ticket_artifact_id: '3ea79946-8cf2-4792-9239-5b148f9f95eb',
            artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
            key: 'tickets/ticket-id/upload/upload-id/generate.py'
          })
        ]}
      />
    );

    expect(screen.getByRole('button', { name: 'generate.py' })).not.toHaveAttribute('href');
    expect(screen.queryByText('3ea79946-8cf2-4792-9239-5b148f9f95eb')).not.toBeInTheDocument();
  });

  it('uses artifact keys for multiple ticket artifact links', () => {
    render(
      <TicketMarkdownContent
        content={[
          '[3ea79946-8cf2-4792-9239-5b148f9f95eb](/artifact/3ea79946-8cf2-4792-9239-5b148f9f95eb)',
          '[bb0fb15e-9567-48a2-b310-b98db9483b07](/artifact/bb0fb15e-9567-48a2-b310-b98db9483b07)'
        ].join(' ')}
        artifacts={[
          ticketArtifact({
            ticket_artifact_id: '3ea79946-8cf2-4792-9239-5b148f9f95eb',
            artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
            key: 'tickets/ticket-id/upload/upload-id/artifact.py'
          }),
          ticketArtifact({
            ticket_artifact_id: 'bb0fb15e-9567-48a2-b310-b98db9483b07',
            artifact_id: 'aaaaaaaa-1b23-4064-ad62-f83c291d31d2',
            key: 'tickets/ticket-id/upload/upload-id/readme.md'
          })
        ]}
      />
    );

    expect(screen.getByRole('button', { name: 'artifact.py' })).not.toHaveAttribute('href');
    expect(screen.getByRole('button', { name: 'readme.md' })).not.toHaveAttribute('href');
    expect(screen.queryByText('3ea79946-8cf2-4792-9239-5b148f9f95eb')).not.toBeInTheDocument();
    expect(screen.queryByText('bb0fb15e-9567-48a2-b310-b98db9483b07')).not.toBeInTheDocument();
  });

  it('renders known artifact images as downloadable attachment links', () => {
    render(
      <TicketMarkdownContent
        content="![diagram](/artifact/90b6df74-1b23-4064-ad62-f83c291d31d2)"
        artifacts={[
          ticketArtifact({
            ticket_artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
            artifact_id: '11111111-1111-4111-8111-111111111111',
            key: 'tickets/ticket-id/upload/upload-id/diagram.png'
          })
        ]}
      />
    );

    expect(screen.getByRole('button', { name: 'diagram.png' })).not.toHaveAttribute('href');
  });

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
            key: 'tickets/ticket-id/upload/upload-id/report.pdf'
          })
        ]}
      />
    );

    expect(screen.queryByText('File not found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'report.pdf' })).not.toHaveAttribute('href');
  });

  it('scopes artifact lookup to the current component instance', () => {
    const artifact = ticketArtifact({
      ticket_artifact_id: '3ea79946-8cf2-4792-9239-5b148f9f95eb',
      artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
      key: 'tickets/ticket-id/upload/upload-id/report.pdf'
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

    expect(within(screen.getByTestId('first-markdown')).getByRole('button', { name: 'report.pdf' })).toBeVisible();
    expect(within(screen.getByTestId('second-markdown')).getByText('File not found')).toBeVisible();
    expect(within(screen.getByTestId('second-markdown')).queryByRole('button', { name: 'report.pdf' })).not.toBeInTheDocument();
  });
});
