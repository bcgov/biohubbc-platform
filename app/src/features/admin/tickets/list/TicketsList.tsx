import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { ITicket } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import { getRelativeTimeLabel } from 'utils/date';
import { TicketsNoRowsOverlay } from './TicketsNoRowsOverlay';

interface ITicketsListProps {
  tickets: ITicket[];
  isLoading: boolean;
  emptyTitle: string;
  emptyMessage: string;
  onTicketClick: (ticketId: string) => void;
}

/**
 * Presentational tickets list rendered as a DataGrid table.
 *
 * @param {ITicketsListProps} props
 * @return {*}
 */
export const TicketsList = (props: ITicketsListProps) => {
  const { tickets, isLoading, emptyTitle, emptyMessage, onTicketClick } = props;

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
        field: 'title',
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
    <LoadingGuard
      isLoading={isLoading}
      isLoadingFallback={
        <Stack gap={2}>
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={560} />
        </Stack>
      }>
      <Paper elevation={0}>
        <CustomDataGrid
          rows={tickets}
          columns={columns}
          getRowId={(row) => row.ticket_id}
          autoHeight
          hideFooter
          disableColumnSelector
          disableDensitySelector
          disableRowSelectionOnClick
          onRowClick={(params) => onTicketClick(params.row.ticket_id)}
          noRowsOverlay={<TicketsNoRowsOverlay emptyTitle={emptyTitle} emptyMessage={emptyMessage} />}
          sx={{
            '--DataGrid-overlayHeight': '220px',
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 700
            }
          }}
        />
      </Paper>
    </LoadingGuard>
  );
};
