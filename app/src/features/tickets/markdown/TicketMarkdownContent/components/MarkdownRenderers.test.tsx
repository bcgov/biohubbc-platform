import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import ReactMarkdown from 'react-markdown';
import { render } from 'test-helpers/test-utils';
import { ticketMarkdownUrlTransform } from 'utils/markdown';
import { getTicketMarkdownComponents } from './MarkdownRenderers';

const ticketArtifact = (
  artifact: Pick<ITicketArtifact, 'ticket_artifact_id' | 'artifact_id' | 'object_key'>
): ITicketArtifact => ({
  ticket_id: '22222222-2222-4222-8222-222222222222',
  record_end_date: null,
  create_date: '2026-02-25T00:00:00.000Z',
  ...artifact
});

const renderMarkdown = (
  content: string,
  props: Parameters<typeof getTicketMarkdownComponents>[0] = { artifactsById: new Map() }
) =>
  render(
    <ReactMarkdown urlTransform={ticketMarkdownUrlTransform} components={getTicketMarkdownComponents(props)}>
      {content}
    </ReactMarkdown>
  );

describe('MarkdownRenderers', () => {
  it('renders markdown typography and list nodes with semantic elements', () => {
    renderMarkdown(
      [
        '# Primary',
        '## Secondary',
        '### Tertiary',
        '',
        'Paragraph with **bold**, *italic*, and `code`.',
        '',
        '- First bullet',
        '- Second bullet',
        '',
        '1. First ordered',
        '2. Second ordered'
      ].join('\n')
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Primary' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Secondary' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Tertiary' })).toBeVisible();
    expect(screen.getByText('bold', { selector: 'strong' })).toBeVisible();
    expect(screen.getByText('italic', { selector: 'em' })).toBeVisible();
    expect(screen.getByText('code', { selector: 'code' })).toBeVisible();
    expect(screen.getByText('First bullet')).toBeVisible();
    expect(screen.getByText('Second bullet')).toBeVisible();
    expect(screen.getByText('First ordered')).toBeVisible();
    expect(screen.getByText('Second ordered')).toBeVisible();
  });

  it('renders external links as safe anchors', () => {
    renderMarkdown('[BioHub](https://example.com)');

    expect(screen.getByRole('link', { name: 'BioHub' })).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByRole('link', { name: 'BioHub' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'BioHub' })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders resolved artifact links with markdown labels as buttons and delegates clicks', async () => {
    const user = userEvent.setup();
    const artifact = ticketArtifact({
      ticket_artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
      artifact_id: '11111111-1111-4111-8111-111111111111',
      object_key: 'tickets/ticket-id/upload/upload-id/generate.py'
    });
    const handleArtifactClick = vi.fn().mockResolvedValue(undefined);

    renderMarkdown('[gen.py](/artifact/90b6df74-1b23-4064-ad62-f83c291d31d2)', {
      artifactsById: new Map([[artifact.ticket_artifact_id, artifact]]),
      onArtifactLinkClick: handleArtifactClick
    });

    const linkButton = screen.getByRole('button', { name: 'gen.py' });

    expect(linkButton).not.toHaveAttribute('href');

    await user.click(linkButton);

    expect(handleArtifactClick).toHaveBeenCalledWith(artifact);
  });

  it('renders missing artifact links and images as file-not-found text', () => {
    renderMarkdown(
      [
        '[missing file](/artifact/90b6df74-1b23-4064-ad62-f83c291d31d2)',
        '![missing image](/artifact/3ea79946-8cf2-4792-9239-5b148f9f95eb)'
      ].join('\n')
    );

    expect(screen.getAllByText('File not found')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'missing file' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'missing image' })).not.toBeInTheDocument();
  });

  it('renders resolved artifact images as downloadable file buttons with markdown alt text', () => {
    const artifact = ticketArtifact({
      ticket_artifact_id: '90b6df74-1b23-4064-ad62-f83c291d31d2',
      artifact_id: '11111111-1111-4111-8111-111111111111',
      object_key: 'tickets/ticket-id/upload/upload-id/diagram.png'
    });

    renderMarkdown('![diagram](/artifact/90b6df74-1b23-4064-ad62-f83c291d31d2)', {
      artifactsById: new Map([[artifact.ticket_artifact_id, artifact]])
    });

    expect(screen.getByRole('button', { name: 'diagram' })).not.toHaveAttribute('href');
    expect(screen.queryByRole('img', { name: 'diagram' })).not.toBeInTheDocument();
  });

  it('renders ordinary markdown images as constrained images', () => {
    renderMarkdown('![Map preview](https://example.com/map.png)');

    expect(screen.getByRole('img', { name: 'Map preview' })).toHaveAttribute('src', 'https://example.com/map.png');
  });
});
