import {
  TICKET_ATTACHMENT_IMAGE_FILE_EXTENSIONS,
  TICKET_ATTACHMENT_MARKDOWN_FORMATTERS,
  TICKET_ATTACHMENT_MARKDOWN_TYPE_BY_MEDIA_TYPE,
  TicketAttachmentMarkdownType
} from 'constants/ticket';

/**
 * Determine the markdown rendering type for an uploaded attachment.
 *
 * @param {File} file File selected by the user.
 * @returns {TicketAttachmentMarkdownType} Markdown formatter type for the file.
 */
export const getAttachmentMarkdownType = (file: File): TicketAttachmentMarkdownType => {
  const mediaType = file.type.split('/')[0]?.toLowerCase();
  const markdownType = mediaType ? TICKET_ATTACHMENT_MARKDOWN_TYPE_BY_MEDIA_TYPE[mediaType] : undefined;

  if (markdownType) {
    return markdownType;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();

  return extension && TICKET_ATTACHMENT_IMAGE_FILE_EXTENSIONS.has(extension) ? 'image' : 'link';
};

/**
 * Convert an uploaded ticket attachment into the markdown syntax inserted into
 * a comment draft.
 *
 * @param {File} file File selected by the user.
 * @param {string} ticketArtifactId Stable ticket artifact identifier.
 * @returns {string} Markdown image or link text for the uploaded attachment.
 */
export const getArtifactMarkdownByMimeType = (file: File, ticketArtifactId: string) => {
  const href = `/artifact/${ticketArtifactId}`;
  const markdownType = getAttachmentMarkdownType(file);

  return TICKET_ATTACHMENT_MARKDOWN_FORMATTERS[markdownType](file.name, href);
};
