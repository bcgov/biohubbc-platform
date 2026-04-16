import { ITicketListRowActions, TicketsListSection } from 'components/tickets/list/TicketsListSection';
import { ITicket } from 'interfaces/useTicketsApi.interface';
import { IServerPaginationProps } from 'types/pagination';

interface ITicketsContainerProps extends IServerPaginationProps {
  rows: ITicket[];
  searchTerm: string;
  onSearch: (term: string) => void;
  onRowClick: (ticketId: string) => void;
  onAddTicket: () => void;
  rowActions: ITicketListRowActions;
}

/**
 * Tickets container with list actions and dialogs.
 *
 * @param {ITicketsContainerProps} props
 * @return {*}
 */
export const TicketsContainer = (props: ITicketsContainerProps) => {
  const { onAddTicket, rowActions, ...ticketListProps } = props;

  return (
    <TicketsListSection
      {...ticketListProps}
      sectionId="tickets"
      dataTestId="tickets-table"
      onAdd={onAddTicket}
      addLabel="New Ticket"
      rowActions={rowActions}
    />
  );
};
