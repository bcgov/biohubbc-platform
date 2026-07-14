export interface ITicketCommentEditFormValues {
  comment: string;
}

export interface ITicketCommentEditFormProps {
  isSaving: boolean;
  isUploadingAttachment: boolean;
  onUploadAttachment: (file: File, appendMarkdownLink: (markdownLink: string) => void) => Promise<void>;
}
