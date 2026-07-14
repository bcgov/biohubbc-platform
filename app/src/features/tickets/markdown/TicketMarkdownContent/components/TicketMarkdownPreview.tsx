import Box, { BoxProps } from '@mui/material/Box';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { ticketMarkdownUrlTransform } from 'utils/markdown';
import { getTicketMarkdownComponents } from './MarkdownRenderers';

interface ITicketMarkdownPreviewProps extends BoxProps {
  /**
   * Markdown text to preview.
   */
  content: string;
}

/**
 * Render draft ticket comment markdown.
 *
 * Preview assumes artifact references are valid and renders them like file links
 * without download click handlers.
 *
 * @param {ITicketMarkdownPreviewProps} props Markdown preview props and root Box props.
 * @return {JSX.Element}
 */
export const TicketMarkdownPreview = (props: ITicketMarkdownPreviewProps) => {
  const { content, ...boxProps } = props;
  const markdownComponents = useMemo(
    () =>
      getTicketMarkdownComponents({
        artifactsById: new Map(),
        preview: true
      }),
    []
  );

  return (
    <Box {...boxProps}>
      <ReactMarkdown urlTransform={ticketMarkdownUrlTransform} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </Box>
  );
};
