import { TicketsListSection } from 'components/tickets/list/TicketsListSection';
import { ITicket } from 'interfaces/useTicketsApi.interface';
import { IServerPaginationProps } from 'types/pagination';

interface IPortalTicketsContainerProps extends IServerPaginationProps {
  rows: ITicket[];
  searchTerm: string;
  onSearch: (term: string) => void;
  onRowClick: (ticketId: string) => void;
}

/**
 * Portal tickets container with read-only ticket table.
 *
 * @param {IPortalTicketsContainerProps} props
 * @return {*}
 */
export const PortalTicketsContainer = (props: IPortalTicketsContainerProps) => {
  return <TicketsListSection {...props} sectionId="portal-tickets" dataTestId="portal-tickets-table" />;
};
