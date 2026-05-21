import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { IAccessKeyView } from 'interfaces/useApiKeysApi.interface';
import { getFormattedDate } from 'utils/Utils';

export const getKeyStatus = (key: IAccessKeyView): 'Active' | 'Revoked' | 'Expired' => {
  if (key.revoked_at !== null) {
    return 'Revoked';
  }
  if (new Date(key.expires_at) <= new Date()) {
    return 'Expired';
  }
  return 'Active';
};

const statusColor = (status: 'Active' | 'Revoked' | 'Expired') => {
  switch (status) {
    case 'Active':
      return 'success' as const;
    case 'Revoked':
      return 'error' as const;
    case 'Expired':
      return 'warning' as const;
  }
};

interface IPortalApiKeysContainerProps {
  rows: IAccessKeyView[];
  rowCount: number;
  isLoading: boolean;
  searchTerm: string;
  onSearch: (term: string) => void;
  onAdd: () => void;
  onRevoke: (key: IAccessKeyView) => void;
}

/**
 * Portal API keys container using the shared page section and data grid pattern.
 */
export const PortalApiKeysContainer = (props: IPortalApiKeysContainerProps) => {
  const { rows, rowCount, isLoading, searchTerm, onSearch, onAdd, onRevoke } = props;

  const columns: GridColDef<IAccessKeyView>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 280,
      sortable: false
    },
    {
      field: 'key_prefix',
      headerName: 'Key Prefix',
      flex: 1,
      minWidth: 180,
      sortable: false,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      sortable: false,
      valueGetter: (_value, row) => getKeyStatus(row),
      renderCell: (params) => {
        const status = params.value as 'Active' | 'Revoked' | 'Expired';
        return <Chip label={status} color={statusColor(status)} size="small" sx={{ fontWeight: 700 }} />;
      }
    },
    {
      field: 'create_date',
      headerName: 'Created',
      width: 150,
      sortable: false,
      valueGetter: (_value, row) => getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, row.create_date)
    },
    {
      field: 'expires_at',
      headerName: 'Expires',
      width: 150,
      sortable: false,
      valueGetter: (_value, row) => getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, row.expires_at)
    },
    {
      field: 'last_used_at',
      headerName: 'Last Used',
      width: 150,
      sortable: false,
      valueGetter: (_value, row) =>
        row.last_used_at ? getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, row.last_used_at) : '—'
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => {
        const status = getKeyStatus(params.row);
        if (status !== 'Active') {
          return null;
        }
        return (
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              onRevoke(params.row);
            }}>
            Revoke
          </Button>
        );
      }
    }
  ];

  return (
    <PageSection
      id="portal-api-keys"
      label={
        <>
          API Keys{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </>
      }
      onAdd={onAdd}
      addLabel="Create API Key"
      headerContent={
        <Stack gap={1} direction="row" alignItems="center">
          <TextField
            size="small"
            placeholder="Search by key name or prefix"
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
      <div data-testid="portal-api-keys-table">
        <CustomDataGrid
          autoHeight
          rows={rows}
          columns={columns}
          getRowId={(row) => row.access_key_id}
          loading={isLoading}
          noRowsMessage="No API keys found."
          pageSizeOptions={[10, 25, 50]}
          rowSelection={false}
        />
      </div>
    </PageSection>
  );
};
