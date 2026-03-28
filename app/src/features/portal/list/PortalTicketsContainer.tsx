import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { ITicket } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import { IServerPaginationProps } from 'types/pagination';
import { getRelativeTimeLabel } from 'utils/date';

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
  const {
    rows,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    searchTerm,
    onSearch,
    onRowClick
  } = props;

  const columns: GridColDef<ITicket>[] = useMemo(
    () => [
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
    ],
    []
  );

  return (
    <PageSection
      id="portal-tickets"
      label={
        <>
          Tickets{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </>
      }
      headerContent={
        <Stack gap={1} direction="row" alignItems="center">
          <TextField
            size="small"
            placeholder="Search by ticket subject"
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
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
        dataTestId="portal-tickets-table"
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
