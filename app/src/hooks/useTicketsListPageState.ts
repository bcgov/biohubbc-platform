import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IGetTicketsResponse, ITicket } from 'interfaces/useTicketsApi.interface';

type TicketListFetcher = (params: {
  search: string;
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}) => Promise<IGetTicketsResponse>;

const DEFAULT_PAGE_SIZE = 10;

/**
 * Shared server-backed ticket list state for both portal and admin list pages.
 *
 * Keeps pagination/sorting/search defaults identical so both experiences remain
 * visually and behaviorally in sync unless explicitly overridden.
 *
 * @param {TicketListFetcher} fetchTickets
 * @returns {*}
 */
export const useTicketsListPageState = (fetchTickets: TicketListFetcher) => {
  return useServerPaginatedDataGrid<ITicket, IGetTicketsResponse>({
    fetcher: (search, pagination) => fetchTickets({ search, ...pagination }),
    extractData: (response) => response.tickets,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'create_date', sort: 'desc' },
    defaultPageSize: DEFAULT_PAGE_SIZE
  });
};
