import { mdiFileOutline, mdiFileQuestionOutline, mdiLinkBoxOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { TICKET_MARKDOWN_HTTP_HREF_PATTERN } from 'constants/ticket';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { MouseEvent, ReactNode } from 'react';
import { Components } from 'react-markdown';
import {
  getArtifactHref,
  getArtifactLinkText,
  getTicketArtifactIdFromUrl,
  isTicketArtifactReferenceUrl
} from 'utils/markdown';

interface ITicketMarkdownComponentsProps {
  /**
   * Ticket artifacts keyed by `ticket_artifact_id`.
   *
   * Link and image renderers use this map to resolve markdown artifact references
   * such as `/tickets/artifacts/{ticketArtifactId}` to the corresponding upload
   * metadata before invoking the download callback.
   */
  artifactsById: Map<string, ITicketArtifact>;

  /**
   * Optional callback used when a resolved artifact reference is selected.
   *
   * The renderer prevents the browser's default navigation and passes the matched
   * artifact to this callback so the parent component can request a signed
   * download URL, open the file, or surface any API error state.
   */
  onArtifactLinkClick?: (artifact: ITicketArtifact) => Promise<void> | void;

  /**
   * Whether to render draft preview behavior for unresolved artifact references.
   */
  preview?: boolean;
}

/**
 * Render a level-one markdown heading with ticket-comment typography.
 *
 * React Markdown invokes this component for `# Heading` nodes. The visual
 * treatment intentionally uses MUI `h6` sizing while preserving semantic `h1`
 * markup so headings fit inside compact ticket comments.
 *
 * @param props - React Markdown heading props.
 * @param props.children - Rendered heading content.
 * @returns JSX for the rendered heading.
 */
const MarkdownH1: NonNullable<Components['h1']> = ({ children }) => (
  <Typography variant="h6" component="h1" gutterBottom>
    {children}
  </Typography>
);

/**
 * Render a level-two markdown heading with compact subtitle styling.
 *
 * React Markdown invokes this component for `## Heading` nodes. Use it when
 * ticket markdown needs a secondary section heading that remains visually
 * subordinate to the surrounding ticket UI.
 *
 * @param props - React Markdown heading props.
 * @param props.children - Rendered heading content.
 * @returns JSX for the rendered heading.
 */
const MarkdownH2: NonNullable<Components['h2']> = ({ children }) => (
  <Typography variant="subtitle1" component="h2" fontWeight={700} gutterBottom>
    {children}
  </Typography>
);

/**
 * Render a level-three markdown heading as emphasized body text.
 *
 * React Markdown invokes this component for `### Heading` nodes. The component
 * keeps the semantic `h3` element while matching the denser body scale used in
 * ticket comments.
 *
 * @param props - React Markdown heading props.
 * @param props.children - Rendered heading content.
 * @returns JSX for the rendered heading.
 */
const MarkdownH3: NonNullable<Components['h3']> = ({ children }) => (
  <Typography variant="body1" component="h3" fontWeight={700} gutterBottom>
    {children}
  </Typography>
);

/**
 * Render a markdown paragraph with ticket-comment body spacing.
 *
 * React Markdown invokes this component for paragraph nodes. The bottom margin
 * gives consecutive markdown blocks readable separation while removing trailing
 * whitespace from the final paragraph in a comment.
 *
 * @param props - React Markdown paragraph props.
 * @param props.children - Rendered paragraph content.
 * @returns JSX for the rendered paragraph.
 */
const MarkdownParagraph: NonNullable<Components['p']> = ({ children }) => (
  <Typography variant="body2" component="p" sx={{ mb: 1.5, whiteSpace: 'pre-wrap', '&:last-child': { mb: 0 } }}>
    {children}
  </Typography>
);

/**
 * Render an unordered markdown list with ticket-comment indentation.
 *
 * React Markdown invokes this component for `-`, `*`, or `+` list nodes. The
 * component owns only the list container; individual item typography is handled
 * by `MarkdownListItem`.
 *
 * @param props - React Markdown unordered list props.
 * @param props.children - Rendered list item content.
 * @returns JSX for the rendered unordered list.
 */
const MarkdownUnorderedList: NonNullable<Components['ul']> = ({ children }) => (
  <Box component="ul" sx={{ pl: 3, my: 1.5 }}>
    {children}
  </Box>
);

/**
 * Render an ordered markdown list with ticket-comment indentation.
 *
 * React Markdown invokes this component for numbered list nodes. It preserves
 * browser numbering behavior while aligning list spacing with unordered lists.
 *
 * @param props - React Markdown ordered list props.
 * @param props.children - Rendered list item content.
 * @returns JSX for the rendered ordered list.
 */
const MarkdownOrderedList: NonNullable<Components['ol']> = ({ children }) => (
  <Box component="ol" sx={{ pl: 3, my: 1.5 }}>
    {children}
  </Box>
);

/**
 * Render a markdown list item using ticket-comment body typography.
 *
 * React Markdown invokes this component for each `li` node inside ordered and
 * unordered lists. It keeps semantic list item markup while applying consistent
 * comment text sizing and item spacing.
 *
 * @param props - React Markdown list item props.
 * @param props.children - Rendered list item content.
 * @returns JSX for the rendered list item.
 */
const MarkdownListItem: NonNullable<Components['li']> = ({ children }) => (
  <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
    {children}
  </Typography>
);

/**
 * Render markdown strong text with MUI-compatible styling.
 *
 * React Markdown invokes this component for `**strong**` and `__strong__`
 * nodes. The semantic `strong` element is preserved while styling goes through
 * MUI's `sx` system.
 *
 * @param props - React Markdown strong text props.
 * @param props.children - Rendered strong text content.
 * @returns JSX for the rendered strong text.
 */
const MarkdownStrong: NonNullable<Components['strong']> = ({ children }) => (
  <Box component="strong" sx={{ fontWeight: 700 }}>
    {children}
  </Box>
);

/**
 * Render markdown emphasized text with MUI-compatible styling.
 *
 * React Markdown invokes this component for `*emphasis*` and `_emphasis_`
 * nodes. The semantic `em` element is preserved while styling goes through
 * MUI's `sx` system.
 *
 * @param props - React Markdown emphasis props.
 * @param props.children - Rendered emphasized content.
 * @returns JSX for the rendered emphasized text.
 */
const MarkdownEmphasis: NonNullable<Components['em']> = ({ children }) => (
  <Box component="em" sx={{ fontStyle: 'italic' }}>
    {children}
  </Box>
);

/**
 * Render inline markdown code with a compact code-chip treatment.
 *
 * React Markdown invokes this component for backtick code spans. Ticket comments
 * currently render inline code only; if fenced code blocks need distinct styling,
 * split block handling into a separate renderer before adding block-specific UI.
 *
 * @param props - React Markdown code props.
 * @param props.children - Rendered code content.
 * @returns JSX for the rendered inline code.
 */
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

/**
 * Render an unresolved artifact reference using the markdown-authored label.
 *
 * Link and image renderers use this component when a URL has ticket-artifact
 * syntax but no matching artifact exists in `artifactsById`.
 *
 * @param props - Component props.
 * @param props.children - Markdown-authored label text.
 * @param props.path - Referenced artifact path.
 * @returns JSX for the unresolved artifact link presentation.
 */
const MissingArtifactLabel = ({ children, path }: { children: ReactNode; path: string }) => (
  <Tooltip title={`File not found: ${path}`}>
    <Typography
      component="span"
      variant="inherit"
      color="text.secondary"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        borderBottom: '1px dotted currentColor',
        cursor: 'help',
        fontWeight: 500,
        verticalAlign: 'text-bottom'
      }}>
      <Icon path={mdiFileQuestionOutline} size={0.6} aria-hidden="true" />
      {children || path}
    </Typography>
  </Tooltip>
);

/**
 * Render a preview artifact reference without assuming artifact metadata exists.
 *
 * @param props - Component props.
 * @param props.children - Markdown-authored label text.
 * @returns JSX for the preview artifact link presentation.
 */
const PreviewArtifactLink = ({ children }: { children: ReactNode }) => (
  <Link
    component="span"
    underline="always"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.25,
      fontWeight: 700,
      verticalAlign: 'text-bottom'
    }}>
    <Icon path={mdiFileOutline} size={0.6} aria-hidden="true" />
    {children}
  </Link>
);

const getUnresolvedArtifactContent = (label: ReactNode, path: string) => (
  <MissingArtifactLabel path={path}>{label}</MissingArtifactLabel>
);

/**
 * Build the markdown anchor renderer for a specific ticket artifact map.
 *
 * The returned component handles two link types:
 * ticket artifact references are rendered as button-style links that call
 * `onArtifactLinkClick`, while ordinary links are rendered as external anchors
 * with safe `target` and `rel` attributes. Unresolved ticket artifact references
 * render as non-interactive labels.
 *
 * @param props - Artifact lookup data and optional click behavior.
 * @param props.artifactsById - Ticket artifacts keyed by `ticket_artifact_id`.
 * @param props.onArtifactLinkClick - Optional callback for resolved artifact links.
 * @returns A React Markdown `a` renderer bound to the supplied artifact state.
 */
const getMarkdownLink =
  ({
    artifactsById,
    onArtifactLinkClick,
    preview = false
  }: ITicketMarkdownComponentsProps): NonNullable<Components['a']> =>
  ({ children, href }) => {
    const normalizedHref = href ?? '';
    const isArtifactReference = isTicketArtifactReferenceUrl(normalizedHref);
    const ticketArtifactId = getTicketArtifactIdFromUrl(normalizedHref);
    const artifactAction = ticketArtifactId ? artifactsById.get(ticketArtifactId) : undefined;
    const resolvedHref = getArtifactHref(normalizedHref);
    const isHttpLink = TICKET_MARKDOWN_HTTP_HREF_PATTERN.test(resolvedHref);

    if (isArtifactReference && preview) {
      return <PreviewArtifactLink>{children}</PreviewArtifactLink>;
    }

    if (isArtifactReference && !artifactAction) {
      return getUnresolvedArtifactContent(children, resolvedHref);
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

/**
 * Build the markdown image renderer for a specific ticket artifact map.
 *
 * The returned component treats markdown images that point at ticket artifact
 * URLs as downloadable artifact references instead of direct image loads. Plain
 * image URLs still render as constrained `img` elements, while unresolved
 * artifact references render as non-interactive labels.
 *
 * @param props - Artifact lookup data and optional click behavior.
 * @param props.artifactsById - Ticket artifacts keyed by `ticket_artifact_id`.
 * @param props.onArtifactLinkClick - Optional callback for resolved artifact images.
 * @returns A React Markdown `img` renderer bound to the supplied artifact state.
 */
const getMarkdownImage =
  ({
    artifactsById,
    onArtifactLinkClick,
    preview = false
  }: ITicketMarkdownComponentsProps): NonNullable<Components['img']> =>
  ({ alt, src }) => {
    const normalizedSrc = src ?? '';
    const isArtifactReference = isTicketArtifactReferenceUrl(normalizedSrc);
    const ticketArtifactId = getTicketArtifactIdFromUrl(normalizedSrc);
    const artifact = ticketArtifactId ? artifactsById.get(ticketArtifactId) : undefined;
    const displayName = artifact ? getArtifactLinkText(artifact, alt) : alt;

    if (isArtifactReference && preview) {
      return <PreviewArtifactLink>{displayName}</PreviewArtifactLink>;
    }

    if (isArtifactReference && !artifact) {
      return getUnresolvedArtifactContent(displayName, normalizedSrc);
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

/**
 * Create the complete React Markdown component map for ticket comments.
 *
 * `TicketMarkdownContent` calls this factory and passes the result to
 * `ReactMarkdown.components`. Static typography renderers are shared across
 * calls, while link and image renderers are recreated with the current artifact
 * map so they can resolve ticket-specific attachment references.
 *
 * @param props - Artifact lookup data and optional click behavior for this render.
 * @returns React Markdown component overrides for ticket markdown content.
 */
export const getTicketMarkdownComponents = (props: ITicketMarkdownComponentsProps): Components => ({
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
  a: getMarkdownLink(props),
  img: getMarkdownImage(props)
});
