import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { Dispatch, SetStateAction } from 'react';

export interface IPortalTicketDetailPageContentProps {
  ticket: ITicketExtended;
  comment: string;
  setComment: Dispatch<SetStateAction<string>>;
  isSavingComment: boolean;
  isUploadingAttachment: boolean;
  onAddComment: () => Promise<void>;
  onUploadAttachment: (file: File) => Promise<void>;
}
