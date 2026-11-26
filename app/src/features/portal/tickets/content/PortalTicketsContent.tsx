import { TicketsListSection } from 'components/tickets/list/TicketsListSection';
import { ITicket } from 'interfaces/useTicketsApi.interface';
import { IServerPaginationProps } from 'types/pagination';

interface IPortalTicketsContentProps extends IServerPaginationProps {
  rows: ITicket[];
  searchTerm: string;
  onSearch: (term: string) => void;
  onRowClick: (ticketId: string) => void;
}

/**
 * Read-only tickets table of the portal.
 *
 * @param {IPortalTicketsContentProps} props - Ticket rows, pagination state, search, and navigation callback.
 * @return {JSX.Element} The tickets section and table.
 */
export const PortalTicketsContent = (props: IPortalTicketsContentProps) => {
  return <TicketsListSection {...props} sectionId="portal-tickets" dataTestId="portal-tickets-table" />;
};
