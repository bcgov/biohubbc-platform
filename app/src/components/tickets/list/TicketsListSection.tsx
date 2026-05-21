import { mdiClose, mdiDotsVertical, mdiMagnify, mdiPencil, mdiRefresh, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ITicket, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import { IServerPaginationProps } from 'types/pagination';
import { getRelativeTimeLabel } from 'utils/date';

export interface ITicketListRowActions {
  onEditTicket?: (ticket: ITicket) => void;
  onToggleTicketStatus?: (ticket: ITicket, nextStatus: TicketStatus) => void;
  onDeleteTicket?: (ticket: ITicket) => void;
}

interface ITicketsListSectionProps extends IServerPaginationProps {
  sectionId: string;
  dataTestId: string;
  rows: ITicket[];
  searchTerm: string;
  onSearch: (term: string) => void;
  onRowClick: (ticketId: string) => void;
  searchPlaceholder?: string;
  onAdd?: () => void;
  addLabel?: string;
  rowActions?: ITicketListRowActions;
}

/**
 * Shared ticket list section used by both admin and portal pages.
 *
 * The section is fully prop-driven: it renders the same search + table styling
 * in both contexts, and only enables mutable row actions when handlers are provided.
 *
 * @param {ITicketsListSectionProps} props
 * @returns {JSX.Element}
 */
export const TicketsListSection = (props: ITicketsListSectionProps) => {
  const {
    sectionId,
    dataTestId,
    rows,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    searchTerm,
    onSearch,
    onRowClick,
    searchPlaceholder = 'Search by ticket subject',
    onAdd,
    addLabel,
    rowActions
  } = props;

  const { onEditTicket, onToggleTicketStatus, onDeleteTicket } = rowActions || {};

  const columns: GridColDef<ITicket>[] = useMemo(() => {
    const baseColumns: GridColDef<ITicket>[] = [
      {
        field: 'ticket_slug',
        headerName: 'Ticket ID',
        minWidth: 130,
        flex: 0.8,
        sortable: false,
        renderCell: (params) => <Typography variant="body2">#{params.value}</Typography>
      },
      {
        field: 'subject',
        headerName: 'Subject',
        minWidth: 280,
        flex: 2,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value || ''}>
            {params.value}
          </Typography>
        )
      },
      {
        field: 'priority',
        headerName: 'Priority',
        minWidth: 30,
        flex: 0.9,
        sortable: false,
        renderCell: (params) => <Typography variant="body2">{params.value}</Typography>
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 140,
        flex: 0.8,
        sortable: false,
        renderCell: (params) => (
          <Chip
            label={params.value}
            size="small"
            color={params.value === 'open' ? 'success' : 'default'}
            sx={{ fontWeight: 700, textTransform: 'capitalize' }}
          />
        )
      },
      {
        field: 'create_date',
        headerName: 'Created',
        minWidth: 140,
        flex: 1,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value || ''}>
            {getRelativeTimeLabel(typeof params.value === 'string' ? params.value : undefined)}
          </Typography>
        )
      }
    ];

    if (!onEditTicket && !onToggleTicketStatus && !onDeleteTicket) {
      return baseColumns;
    }

    return [
      ...baseColumns,
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 100,
        flex: 0.6,
        sortable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => {
          const menuItems = [];

          if (onEditTicket) {
            menuItems.push({
              menuIcon: <Icon path={mdiPencil} size={0.875} />,
              menuLabel: 'Edit ticket',
              menuOnClick: () => onEditTicket(params.row)
            });
          }

          if (onToggleTicketStatus) {
            menuItems.push({
              menuIcon: <Icon path={params.row.status === 'open' ? mdiClose : mdiRefresh} size={0.875} />,
              menuLabel: params.row.status === 'open' ? 'Close ticket' : 'Reopen ticket',
              menuOnClick: () => onToggleTicketStatus(params.row, params.row.status === 'open' ? 'closed' : 'open')
            });
          }

          if (onDeleteTicket) {
            menuItems.push({
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuLabel: 'Remove ticket',
              menuOnClick: () => onDeleteTicket(params.row)
            });
          }

          return (
            <Box onClick={(event) => event.stopPropagation()}>
              <CustomMenuIconButton
                buttonTitle="Actions"
                buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
                menuItems={menuItems}
              />
            </Box>
          );
        }
      }
    ];
  }, [onDeleteTicket, onEditTicket, onToggleTicketStatus]);

  return (
    <PageSection
      id={sectionId}
      label={
        <>
          Tickets{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </>
      }
      onAdd={onAdd}
      addLabel={addLabel}
      headerContent={
        <Stack gap={1} direction="row" alignItems="center">
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(event) => onSearch(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon path={mdiMagnify} size={0.875} />
                  </InputAdornment>
                )
              }
            }}
            sx={{ width: 250 }}
          />
        </Stack>
      }>
      <ServerPaginatedDataGrid<ITicket>
        dataTestId={dataTestId}
        rows={rows}
        columns={columns}
        getRowId={(row) => row.ticket_id}
        noRowsMessage="No tickets"
        rowCount={rowCount}
        paginationModel={paginationModel}
        setPaginationModel={setPaginationModel}
        sortModel={sortModel}
        setSortModel={setSortModel}
        onRowClick={(row) => onRowClick(row.ticket_id)}
      />
    </PageSection>
  );
};
