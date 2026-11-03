import Stack from '@mui/material/Stack';
import { GridColDef } from '@mui/x-data-grid';
import { TagAutocomplete } from 'components/tags/TagAutocomplete';
import { TagChip } from 'components/tags/TagChip';
import { ITicketListRowActions, TicketsListSection } from 'components/tickets/list/TicketsListSection';
import { ITagSummary } from 'interfaces/useTagsApi.interface';
import { ITicketWithTags } from 'interfaces/useTicketsApi.interface';
import { IServerPaginationProps } from 'types/pagination';

interface ITicketsContainerProps extends IServerPaginationProps {
  rows: ITicketWithTags[];
  searchTerm: string;
  onSearch: (term: string) => void;
  onRowClick: (ticketId: string) => void;
  onAddTicket: () => void;
  rowActions: ITicketListRowActions;
  /** Tags the list is filtered by; a ticket with any of them is listed. */
  tagFilter: ITagSummary[];
  onTagFilterChange: (tags: ITagSummary[]) => void;
}

/** The administrative list's tags column: each ticket's tags as chips. */
const TICKET_TAGS_COLUMNS: GridColDef<ITicketWithTags>[] = [
  {
    field: 'tags',
    headerName: 'Tags',
    minWidth: 200,
    flex: 1.5,
    sortable: false,
    renderCell: (params) => (
      <Stack direction="row" gap={0.5} alignItems="center" sx={{ height: '100%', overflow: 'hidden' }}>
        {params.row.tags.map((tag) => (
          <TagChip key={tag.tag_id} tag={tag} />
        ))}
      </Stack>
    )
  }
];

/**
 * Administrative tickets list: the shared ticket list with each ticket's tags, a tag filter, and list actions.
 *
 * @param {ITicketsContainerProps} props
 * @return {*}
 */
export const TicketsContainer = (props: ITicketsContainerProps) => {
  const { onAddTicket, rowActions, tagFilter, onTagFilterChange, ...ticketListProps } = props;

  return (
    <TicketsListSection<ITicketWithTags>
      {...ticketListProps}
      sectionId="tickets"
      dataTestId="tickets-table"
      onAdd={onAddTicket}
      addLabel="New Ticket"
      rowActions={rowActions}
      additionalColumns={TICKET_TAGS_COLUMNS}
      filters={
        <TagAutocomplete
          id="tickets-tag-filter"
          size="small"
          placeholder={tagFilter.length ? undefined : 'Filter by tag'}
          value={tagFilter}
          onChange={onTagFilterChange}
          sx={{ minWidth: 250, maxWidth: 400 }}
        />
      }
    />
  );
};
