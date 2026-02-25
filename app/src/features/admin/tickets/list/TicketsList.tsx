import Icon from '@mdi/react';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { ITicket, TicketPriority } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import { TicketsNoRowsOverlay } from './TicketsNoRowsOverlay';
import { getPriorityDisplay } from '../utils/priority';

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
  const theme = useTheme();

  /**
   * Type guard for ticket priority values coming from DataGrid cell params.
   *
   * @param {unknown} value
   * @return {value is TicketPriority}
   */
  const isTicketPriority = (value: unknown): value is TicketPriority =>
    value === 'low' || value === 'medium' || value === 'high' || value === 'critical';

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
        minWidth: 150,
        flex: 0.9,
        sortable: false,
        renderCell: (params) => {
          if (!isTicketPriority(params.value)) {
            return null;
          }

          const priority = getPriorityDisplay(params.value, theme);

          return (
            <Chip
              icon={<Icon path={priority.path} size={0.7} color={priority.color} />}
              label={priority.label}
              size="small"
              variant="outlined"
              sx={{
                fontWeight: 700,
                color: priority.color,
                borderColor: priority.color,
                '& .MuiChip-icon': {
                  ml: 0.5
                }
              }}>
            </Chip>
          );
        }
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 140,
        flex: 0.8,
        sortable: false,
        renderCell: (params) => (
          <Chip
            label={params.value === 'open' ? 'Open' : 'Closed'}
            size="small"
            variant="outlined"
            color={params.value === 'open' ? 'primary' : 'default'}
            sx={{ fontWeight: 700 }}
          />
        )
      },
      {
        field: 'team_id',
        headerName: 'Team',
        minWidth: 140,
        flex: 1,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value || ''}>
            {params.value}
          </Typography>
        )
      },
    ],
    [theme]
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
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 700
            }
          }}
        />
      </Paper>
    </LoadingGuard>
  );
};
