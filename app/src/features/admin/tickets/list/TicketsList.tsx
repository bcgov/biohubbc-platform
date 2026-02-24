import { mdiChevronDoubleUp, mdiChevronTripleUp, mdiChevronUp, mdiChevronUpBox } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { orange } from '@mui/material/colors';
import { useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { ITicket } from 'interfaces/useTicketsApi.interface';
import { HTMLAttributes, PropsWithChildren, useMemo } from 'react';

declare module '@mui/x-data-grid' {
  interface NoRowsOverlayPropsOverrides {
    emptyTitle: string;
    emptyMessage: string;
  }
}

interface ITicketsListProps {
  tickets: ITicket[];
  isLoading: boolean;
  emptyTitle: string;
  emptyMessage: string;
  onTicketClick: (ticketRef: string) => void;
}

interface ITicketsNoRowsOverlayProps extends HTMLAttributes<HTMLDivElement> {
  emptyTitle: string;
  emptyMessage: string;
}

const TicketsNoRowsOverlay = (props: PropsWithChildren<ITicketsNoRowsOverlayProps>) => {
  const { emptyTitle, emptyMessage } = props;

  return (
    <Stack alignItems="center" justifyContent="center" p={3} minHeight={220}>
      <Typography data-testid="tickets-empty-title" component="h2" sx={{ mb: 1, fontWeight: 700 }}>
        {emptyTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    </Stack>
  );
};

/**
 * Type guard for ticket priority values coming from DataGrid cell params.
 *
 * @param {unknown} value
 * @return {value is ITicket['priority']}
 */
const isTicketPriority = (value: unknown): value is ITicket['priority'] =>
  value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL';

/**
 * Presentational tickets list rendered as a DataGrid table.
 *
 * @param {ITicketsListProps} props
 * @return {*}
 */
export const TicketsList = (props: ITicketsListProps) => {
  const { tickets, isLoading, emptyTitle, emptyMessage, onTicketClick } = props;
  const theme = useTheme();

  const priorityConfig = useMemo<
    Record<ITicket['priority'], { path: string; color: string; bgColor: string; label: string }>
  >(
    () => ({
      LOW: {
        path: mdiChevronUp,
        color: theme.palette.success.main,
        bgColor: theme.palette.success.light,
        label: 'Low'
      },
      MEDIUM: {
        path: mdiChevronDoubleUp,
        color: theme.palette.primary.main,
        bgColor: theme.palette.primary.light,
        label: 'Medium'
      },
      HIGH: {
        path: mdiChevronTripleUp,
        color: orange[700],
        bgColor: '#fff3e0',
        label: 'High'
      },
      CRITICAL: {
        path: mdiChevronUpBox,
        color: theme.palette.error.main,
        bgColor: theme.palette.error.light,
        label: 'Critical'
      }
    }),
    [theme.palette.error.light, theme.palette.error.main, theme.palette.primary.light, theme.palette.primary.main, theme.palette.success.light, theme.palette.success.main]
  );

  const columns = useMemo<GridColDef<ITicket>[]>(
    () => [
      {
        field: 'ticket_short_id',
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

          const config = priorityConfig[params.value];

          return (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: 10,
                backgroundColor: config.bgColor
              }}>
              <Icon path={config.path} size={0.8} color={config.color} />
              <Typography variant="body2" sx={{ color: config.color, lineHeight: 1.2 }}>
                {config.label}
              </Typography>
            </Box>
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
          <Chip label={params.value} size="small" color={params.value === 'OPEN' ? 'primary' : 'default'} sx={{ fontWeight: 700 }} />
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
      {
        field: 'ticket_number',
        headerName: 'Ticket #',
        minWidth: 120,
        flex: 0.8,
        sortable: false,
        renderCell: (params) => <Typography variant="body2">{params.value}</Typography>
      }
    ],
    [priorityConfig]
  );

  if (isLoading) {
    return (
      <Stack gap={2}>
        <Skeleton variant="rounded" height={64} />
        <Skeleton variant="rounded" height={560} />
      </Stack>
    );
  }

  return (
    <Paper elevation={0}>
      <DataGrid
        rows={tickets}
        columns={columns}
        getRowId={(row) => row.ticket_id}
        autoHeight
        hideFooter
        disableColumnMenu
        disableColumnSelector
        disableDensitySelector
        disableRowSelectionOnClick
        onRowClick={(params) => onTicketClick(params.row.ticket_short_id)}
        slots={{
          noRowsOverlay: TicketsNoRowsOverlay
        }}
        slotProps={{
          noRowsOverlay: {
            emptyTitle,
            emptyMessage
          }
        }}
        sx={{
          border: 0,
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 700
          },
          '& .MuiDataGrid-row': {
            cursor: 'pointer'
          }
        }}
      />
    </Paper>
  );
};
