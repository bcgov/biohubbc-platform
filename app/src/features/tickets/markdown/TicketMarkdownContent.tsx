import { mdiFileOutline, mdiFileQuestionOutline, mdiLinkBoxOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box, { BoxProps } from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import {
  TICKET_ARTIFACT_ID_ONLY_PATTERN,
  TICKET_ARTIFACT_PATH_PATTERN,
  TICKET_ARTIFACT_REFERENCE_PATTERN,
  TICKET_MARKDOWN_HTTP_HREF_PATTERN
} from 'constants/ticket';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { createContext, MouseEvent, ReactNode, useContext, useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';

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

interface ITicketMarkdownRenderContext {
  artifactsById: Map<string, ITicketArtifact>;
  onArtifactLinkClick?: (artifact: ITicketArtifact) => Promise<void> | void;
}

const TicketMarkdownRenderContext = createContext<ITicketMarkdownRenderContext>({
  artifactsById: new Map()
});

const getTicketArtifactIdFromUrl = (url: string) => {
  const artifactPathMatch = TICKET_ARTIFACT_PATH_PATTERN.exec(url);

  if (artifactPathMatch) {
    return artifactPathMatch[1];
  }

  return undefined;
};

const isTicketArtifactReferenceUrl = (url: string) => TICKET_ARTIFACT_REFERENCE_PATTERN.test(url);

const getArtifactHref = (url: string) => {
  const ticketArtifactId = getTicketArtifactIdFromUrl(url);
  return ticketArtifactId ? `/artifact/${ticketArtifactId}` : url;
};

const getArtifactDisplayName = (artifact: ITicketArtifact) => artifact.key.split('/').pop() ?? artifact.key;

const getNodeText = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join('');
  }

  return '';
};

/**
 * Choose the label for a resolved artifact link.
 *
 * File names from artifact keys take priority unless the key itself is only a
 * UUID and the markdown gives a better label.
 *
 * @param {ITicketArtifact} artifact Resolved ticket artifact.
 * @param {ReactNode} children Markdown link children.
 * @return {string} Text shown for the artifact action.
 */
const getArtifactLinkText = (artifact: ITicketArtifact, children: ReactNode) => {
  const artifactDisplayName = getArtifactDisplayName(artifact);
  const markdownLabel = getNodeText(children).trim();

  if (
    TICKET_ARTIFACT_ID_ONLY_PATTERN.test(artifactDisplayName) &&
    markdownLabel &&
    !TICKET_ARTIFACT_ID_ONLY_PATTERN.test(markdownLabel)
  ) {
    return markdownLabel;
  }

  return artifactDisplayName;
};

const ticketMarkdownUrlTransform = (url: string) => {
  if (isTicketArtifactReferenceUrl(url)) {
    return getArtifactHref(url);
  }

  return url;
};

const MarkdownH1: NonNullable<Components['h1']> = ({ children }) => (
  <Typography variant="h6" component="h1" gutterBottom>
    {children}
  </Typography>
);

const MarkdownH2: NonNullable<Components['h2']> = ({ children }) => (
  <Typography variant="subtitle1" component="h2" fontWeight={700} gutterBottom>
    {children}
  </Typography>
);

const MarkdownH3: NonNullable<Components['h3']> = ({ children }) => (
  <Typography variant="body1" component="h3" fontWeight={700} gutterBottom>
    {children}
  </Typography>
);

const MarkdownParagraph: NonNullable<Components['p']> = ({ children }) => (
  <Typography variant="body2" component="p" sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
    {children}
  </Typography>
);

const MarkdownUnorderedList: NonNullable<Components['ul']> = ({ children }) => (
  <Box component="ul" sx={{ pl: 3, my: 1.5 }}>
    {children}
  </Box>
);

const MarkdownOrderedList: NonNullable<Components['ol']> = ({ children }) => (
  <Box component="ol" sx={{ pl: 3, my: 1.5 }}>
    {children}
  </Box>
);

const MarkdownListItem: NonNullable<Components['li']> = ({ children }) => (
  <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
    {children}
  </Typography>
);

const MarkdownStrong: NonNullable<Components['strong']> = ({ children }) => (
  <Box component="strong" sx={{ fontWeight: 700 }}>
    {children}
  </Box>
);

const MarkdownEmphasis: NonNullable<Components['em']> = ({ children }) => (
  <Box component="em" sx={{ fontStyle: 'italic' }}>
    {children}
  </Box>
);

const MarkdownCode: NonNullable<Components['code']> = ({ children }) => (
  <Box
    component="code"
    sx={{
      px: 0.5,
      py: 0.25,
      borderRadius: 0.5,
      fontFamily: 'monospace',
      fontSize: '0.85em',
      bgcolor: 'action.hover'
    }}>
    {children}
  </Box>
);

const MissingArtifactText = () => (
  <Typography
    component="span"
    variant="inherit"
    color="text.secondary"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.25,
      fontWeight: 500,
      verticalAlign: 'text-bottom'
    }}>
    <Icon path={mdiFileQuestionOutline} size={0.6} aria-hidden="true" />
    File not found
  </Typography>
);

const MarkdownLink: NonNullable<Components['a']> = ({ children, href }) => {
  const { artifactsById, onArtifactLinkClick } = useContext(TicketMarkdownRenderContext);
  const normalizedHref = href ?? '';
  const isArtifactReference = isTicketArtifactReferenceUrl(normalizedHref);
  const ticketArtifactId = getTicketArtifactIdFromUrl(normalizedHref);
  const artifactAction = ticketArtifactId ? artifactsById.get(ticketArtifactId) : undefined;
  const resolvedHref = getArtifactHref(normalizedHref);
  const isHttpLink = TICKET_MARKDOWN_HTTP_HREF_PATTERN.test(resolvedHref);

  if (isArtifactReference && !artifactAction) {
    return <MissingArtifactText />;
  }

  if (artifactAction) {
    const handleArtifactClick = async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      await onArtifactLinkClick?.(artifactAction);
    };

    return (
      <Link
        component="button"
        type="button"
        aria-disabled={!onArtifactLinkClick || undefined}
        underline="always"
        onClick={handleArtifactClick}
        sx={{
          border: 0,
          p: 0,
          bgcolor: 'transparent',

          cursor: onArtifactLinkClick ? 'pointer' : 'default',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
          fontWeight: 700,
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          verticalAlign: 'text-bottom'
        }}>
        <Icon path={mdiFileOutline} size={0.6} aria-hidden="true" />
        {getArtifactLinkText(artifactAction, children)}
      </Link>
    );
  }

  return (
    <Link
      href={resolvedHref}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        fontWeight: 700,
        verticalAlign: 'text-bottom'
      }}>
      {isHttpLink ? <Icon path={mdiLinkBoxOutline} size={0.6} aria-hidden="true" /> : null} {children}
    </Link>
  );
};

const MarkdownImage: NonNullable<Components['img']> = ({ alt, src }) => {
  const { artifactsById, onArtifactLinkClick } = useContext(TicketMarkdownRenderContext);
  const normalizedSrc = src ?? '';
  const isArtifactReference = isTicketArtifactReferenceUrl(normalizedSrc);
  const ticketArtifactId = getTicketArtifactIdFromUrl(normalizedSrc);
  const artifact = ticketArtifactId ? artifactsById.get(ticketArtifactId) : undefined;
  const displayName = artifact ? getArtifactDisplayName(artifact) : alt;

  if (isArtifactReference && !artifact) {
    return <MissingArtifactText />;
  }

  if (artifact) {
    const handleArtifactClick = async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      await onArtifactLinkClick?.(artifact);
    };

    return (
      <Link
        component="button"
        type="button"
        aria-disabled={!onArtifactLinkClick || undefined}
        underline="always"
        onClick={handleArtifactClick}
        sx={{
          border: 0,
          p: 0,
          bgcolor: 'transparent',
          cursor: onArtifactLinkClick ? 'pointer' : 'default',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
          fontWeight: 700,
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          verticalAlign: 'text-bottom'
        }}>
        <Icon path={mdiFileOutline} size={0.6} aria-hidden="true" />
        {displayName}
      </Link>
    );
  }

  return (
    <Box component="span" sx={{ display: 'block', my: 1 }}>
      <Box
        component="img"
        alt={displayName ?? ''}
        src={normalizedSrc}
        sx={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: 360,
          borderRadius: 1
        }}
      />
    </Box>
  );
};

const TICKET_MARKDOWN_COMPONENTS: Components = {
  h1: MarkdownH1,
  h2: MarkdownH2,
  h3: MarkdownH3,
  p: MarkdownParagraph,
  ul: MarkdownUnorderedList,
  ol: MarkdownOrderedList,
  li: MarkdownListItem,
  strong: MarkdownStrong,
  em: MarkdownEmphasis,
  code: MarkdownCode,
  a: MarkdownLink,
  img: MarkdownImage
};

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
  const renderContext = useMemo(
    () => ({
      artifactsById: new Map(artifacts.map((artifact) => [artifact.ticket_artifact_id, artifact])),
      onArtifactLinkClick
    }),
    [artifacts, onArtifactLinkClick]
  );

  return (
    <Box {...boxProps}>
      <TicketMarkdownRenderContext.Provider value={renderContext}>
        <ReactMarkdown urlTransform={ticketMarkdownUrlTransform} components={TICKET_MARKDOWN_COMPONENTS}>
          {content}
        </ReactMarkdown>
      </TicketMarkdownRenderContext.Provider>
    </Box>
  );
};
