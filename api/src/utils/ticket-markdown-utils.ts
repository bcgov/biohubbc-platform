const TICKET_ARTIFACT_MARKDOWN_REFERENCE_PATTERN =
  /!?\[[^\]]*\]\(\/artifact\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\)/gi;

/**
 * Extract unique ticket artifact identifiers referenced by ticket markdown.
 *
 * @param {string} markdown Markdown text to inspect.
 * @returns {string[]} Unique `ticket_artifact_id` values in first-seen order.
 */
export const getTicketArtifactIdsFromMarkdown = (markdown: string): string[] => {
  const ticketArtifactIds = new Set<string>();

  for (const match of markdown.matchAll(TICKET_ARTIFACT_MARKDOWN_REFERENCE_PATTERN)) {
    ticketArtifactIds.add(match[1].toLowerCase());
  }

  return Array.from(ticketArtifactIds);
};
