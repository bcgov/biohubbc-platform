import { ITicketWithHistory } from 'interfaces/useTicketsApi.interface';

export interface IPortalTicketDetailPageContentProps {
  ticket: ITicketWithHistory | undefined;
  isLoading: boolean;
  comment: string;
}
