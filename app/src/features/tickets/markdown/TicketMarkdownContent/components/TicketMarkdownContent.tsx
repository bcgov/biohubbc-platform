import Box, { BoxProps } from '@mui/material/Box';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { ticketMarkdownUrlTransform } from 'utils/markdown';
import { getTicketMarkdownComponents } from './MarkdownRenderers';

/**
 * Props for `TicketMarkdownContent`.
 *
 * Renders ticket comment markdown and supports ticket file links like
 * `/artifact/{ticket_artifact_id}`.
 */
interface ITicketMarkdownContentProps extends BoxProps {
  /**
   * Markdown text to render.
   */
  content: string;

  /**
   * Ticket files that markdown links can reference.
   */
  artifacts?: ITicketArtifact[];

  /**
   * Called when the user clicks a resolved ticket artifact link.
   */
  onArtifactLinkClick?: (artifact: ITicketArtifact) => Promise<void> | void;
}

/**
 * Render ticket comment markdown.
 *
 * Pass ticket-level `artifacts` so `/artifact/{ticket_artifact_id}` links can
 * resolve to files. Missing file links render as `File not found`.
 *
 * @param {ITicketMarkdownContentProps} props Markdown renderer props and root Box props.
 * @return {JSX.Element}
 */
export const TicketMarkdownContent = (props: ITicketMarkdownContentProps) => {
  const { content, artifacts = [], onArtifactLinkClick, ...boxProps } = props;
  const markdownComponents = useMemo(
    () =>
      getTicketMarkdownComponents({
        artifactsById: new Map(artifacts.map((artifact) => [artifact.ticket_artifact_id, artifact])),
        onArtifactLinkClick
      }),
    [artifacts, onArtifactLinkClick]
  );

  return (
    <Box {...boxProps}>
      <ReactMarkdown urlTransform={ticketMarkdownUrlTransform} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </Box>
  );
};
