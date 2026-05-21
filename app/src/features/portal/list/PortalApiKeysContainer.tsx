import { mdiCancel, mdiDotsVertical, mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { IAccessKeyView } from 'interfaces/useApiKeysApi.interface';
import { getFormattedDate } from 'utils/Utils';

type KeyStatus = 'Active' | 'Revoked' | 'Expired';

/**
 * Derive the display status of an API key.
 *
 * Precedence: Revoked > Expired > Active.
 *
 * @param {IAccessKeyView} key
 * @return {KeyStatus}
 */
export const getKeyStatus = (key: IAccessKeyView): KeyStatus => {
  if (key.revoked_at !== null) {
    return 'Revoked';
  }
  if (new Date(key.expires_at) <= new Date()) {
    return 'Expired';
  }
  return 'Active';
};

/**
 * Map a `KeyStatus` value to the corresponding MUI Chip colour.
 *
 * @param {KeyStatus} status
 * @return {'success' | 'error' | 'warning'}
 */
const statusColor = (status: KeyStatus): 'success' | 'error' | 'warning' => {
  switch (status) {
    case 'Active':
      return 'success';
    case 'Revoked':
      return 'error';
    case 'Expired':
      return 'warning';
  }
};

interface IPortalApiKeysContainerProps {
  rows: IAccessKeyView[];
  rowCount: number;
  isLoading: boolean;
  /** Current value of the search field. */
  searchTerm: string;
  /** Called when the user changes the search field value. */
  onSearch: (term: string) => void;
  /** Called when the user clicks the "Create API Key" button. */
  onAdd: () => void;
  /** Called when the user clicks the Revoke action for a specific key. */
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
        const status = params.value as KeyStatus;
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
      minWidth: 100,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const status = getKeyStatus(params.row);
        if (status !== 'Active') {
          return null;
        }
        return (
          <Box onClick={(event) => event.stopPropagation()}>
            <CustomMenuIconButton
              buttonTitle="Actions"
              buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
              menuItems={[
                {
                  menuIcon: <Icon path={mdiCancel} size={0.875} />,
                  menuLabel: 'Revoke',
                  menuOnClick: () => onRevoke(params.row)
                }
              ]}
            />
          </Box>
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
          noRowsMessage="No API keys."
          pageSizeOptions={[10, 25, 50]}
          rowSelection={false}
        />
      </div>
    </PageSection>
  );
};
