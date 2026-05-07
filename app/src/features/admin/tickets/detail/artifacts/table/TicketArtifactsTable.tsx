import { mdiContentCopy, mdiDownload } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import dayjs from 'dayjs';
import { getTicketArtifactFileName } from 'features/admin/tickets/utils/ticketArtifactMarkdown';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import { IServerPaginationProps } from 'types/pagination';

interface ITicketArtifactsTableProps extends IServerPaginationProps {
  rows: ITicketArtifact[];
  isLoading: boolean;
  onDownload: (artifact: ITicketArtifact) => Promise<void>;
  onCopy: (artifact: ITicketArtifact) => Promise<void>;
}

/**
 * Prop-driven artifact table for ticket artifacts.
 *
 * Owns the data-grid column definitions and delegates user actions to parent-provided handlers.
 *
 * @param {ITicketArtifactsTableProps} props
 * @return {*}
 */
export const TicketArtifactsTable = (props: ITicketArtifactsTableProps) => {
  const {
    rows,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    isLoading,
    onDownload,
    onCopy
  } = props;

  const columns: GridColDef<ITicketArtifact>[] = useMemo(
    () => [
      { field: 'ticket_artifact_id', headerName: 'Ticket Artifact ID', flex: 1, minWidth: 260 },
      {
        field: 'key',
        headerName: 'Artifact Key',
        flex: 1.5,
        minWidth: 280,
        renderCell: (params) => (
          <Link
            href="#"
            underline="hover"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDownload(params.row);
            }}>
            {getTicketArtifactFileName(params.row)}
          </Link>
        )
      },
      {
        field: 'create_date',
        headerName: 'Create Date',
        flex: 0.8,
        minWidth: 180,
        valueGetter: (_value, row) => dayjs(row.create_date).format(DATE_FORMAT.MediumDateFormat)
      },
      {
        field: 'actions',
        headerName: 'Actions',
        sortable: false,
        filterable: false,
        width: 112,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} onClick={(event) => event.stopPropagation()}>
            <IconButton
              size="small"
              aria-label={`Download ${getTicketArtifactFileName(params.row)}`}
              onClick={() => onDownload(params.row)}>
              <Icon path={mdiDownload} size={0.75} />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`Copy markdown for ${getTicketArtifactFileName(params.row)}`}
              onClick={() => onCopy(params.row)}>
              <Icon path={mdiContentCopy} size={0.75} />
            </IconButton>
          </Box>
        )
      }
    ],
    [onCopy, onDownload]
  );

  return (
    <Box sx={{ height: 520 }}>
      <CustomDataGrid
        rows={rows}
        columns={columns}
        getRowId={(row) => row.ticket_artifact_id}
        loading={isLoading}
        rowCount={rowCount}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        paginationMode="server"
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        sortingMode="server"
        noRowsMessage="No artifacts"
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25, 50]}
      />
    </Box>
  );
};
