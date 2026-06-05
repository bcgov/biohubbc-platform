import { ReactNode } from 'react';
import { defaultUrlTransform } from 'react-markdown';
import { TICKET_ARTIFACT_PATH_PATTERN, TICKET_ARTIFACT_REFERENCE_PATTERN } from 'constants/ticket';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';

/**
 * Extract the ticket artifact UUID from a markdown URL.
 *
 * Ticket comments store file references as markdown URLs using the route shape
 * `/artifact/{ticket_artifact_id}`. The markdown renderer uses this helper to
 * look up matching `ITicketArtifact` metadata before deciding whether to render
 * a clickable file action or a missing-file label.
 *
 * @param {string} url - Markdown URL or image source to inspect.
 * @returns {string | undefined} Ticket artifact UUID when the URL matches the artifact route; otherwise `undefined`.
 */
export const getTicketArtifactIdFromUrl = (url: string) => {
  const artifactPathMatch = TICKET_ARTIFACT_PATH_PATTERN.exec(url);

  if (artifactPathMatch) {
    return artifactPathMatch[1];
  }

  return undefined;
};

/**
 * Check whether a markdown URL is intended to reference a ticket artifact.
 *
 * This is broader than successful UUID extraction: malformed artifact URLs are
 * still treated as artifact references so the UI can render a disabled
 * "File not found" state instead of an external link.
 *
 * @param {string} url - Markdown URL or image source to classify.
 * @returns {boolean} `true` when the URL uses the ticket artifact reference shape.
 */
export const isTicketArtifactReferenceUrl = (url: string) => TICKET_ARTIFACT_REFERENCE_PATTERN.test(url);

/**
 * Normalize a ticket artifact URL to the route used by the client.
 *
 * Valid artifact references are rewritten to `/artifact/{ticket_artifact_id}`
 * so React Markdown receives a stable href after URL transformation. Non-ticket
 * URLs are returned unchanged.
 *
 * @param {string} url - Markdown URL or image source.
 * @returns {string} Normalized ticket artifact href, or the original URL for non-artifact links.
 */
export const getArtifactHref = (url: string) => {
  const ticketArtifactId = getTicketArtifactIdFromUrl(url);
  return ticketArtifactId ? `/artifact/${ticketArtifactId}` : url;
};

/**
 * Get the human-readable filename for a ticket artifact.
 *
 * Ticket artifact keys are object-storage paths. For display, the markdown UI
 * shows only the final path segment so links read like filenames instead of
 * full storage keys. If the key has no slash-delimited basename, the full key is
 * returned.
 *
 * @param {ITicketArtifact} artifact - Ticket artifact metadata from the ticket detail API.
 * @returns {string} File-style display name derived from the artifact object key.
 */
export const getArtifactDisplayName = (artifact: ITicketArtifact) =>
  artifact.object_key.split('/').pop() ?? artifact.object_key;

/**
 * Flatten simple React children into text for link-label decisions.
 *
 * React Markdown passes link children as `ReactNode`. The artifact renderer uses
 * the visible markdown label when deciding whether to prefer the markdown text
 * or the artifact key. Only primitive and array children are flattened; element
 * children intentionally contribute no text because this helper is for simple
 * markdown labels.
 *
 * @param {ReactNode} node - React child node from markdown-rendered content.
 * @returns {string} Concatenated primitive text contained in the node.
 */
export const getNodeText = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join('');
  }

  return '';
};

/**
 * Choose the display label for a resolved ticket artifact link.
 *
 * The markdown label is user-authored and should be preserved when present.
 * The artifact key's filename is used only as a fallback for empty labels.
 *
 * @param {ITicketArtifact} artifact - Resolved ticket artifact metadata.
 * @param {ReactNode} children - Rendered markdown link children.
 * @returns {string} Label to display for the artifact link or image fallback action.
 */
export const getArtifactLinkText = (artifact: ITicketArtifact, children: ReactNode) => {
  const artifactDisplayName = getArtifactDisplayName(artifact);
  const markdownLabel = getNodeText(children).trim();

  return markdownLabel || artifactDisplayName;
};

/**
 * Transform markdown URLs before React Markdown renders them.
 *
 * React Markdown calls this for link hrefs and image sources. Ticket artifact
 * references are normalized to the client artifact route, while all other URLs
 * use React Markdown's default URL transform.
 *
 * @param {string} url - URL provided by React Markdown.
 * @returns {string} Transformed URL used by markdown rendering.
 */
export const ticketMarkdownUrlTransform = (url: string) => {
  if (isTicketArtifactReferenceUrl(url)) {
    return getArtifactHref(url);
  }

  return defaultUrlTransform(url);
};
