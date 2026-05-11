import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';

export interface ITicketCommentEditFormValues {
  comment: string;
}

export interface ITicketCommentEditFormProps {
  artifacts: ITicketArtifact[];
  isSaving: boolean;
  isUploadingAttachment: boolean;
  onUploadAttachment: (file: File, appendMarkdownLink: (markdownLink: string) => void) => Promise<void>;
}
