import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { Dispatch, SetStateAction } from 'react';

export interface IPortalTicketDetailPageContentProps {
  ticket: ITicketExtended | undefined;
  isLoading: boolean;
  comment: string;
  setComment: Dispatch<SetStateAction<string>>;
  isSavingComment: boolean;
  onAddComment: () => Promise<void>;
}
