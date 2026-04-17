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
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { SECURITY_LABEL } from 'constants/security';
import { SubmissionRecordWithSecurityAndRootFeature } from 'interfaces/useSubmissionsApi.interface';
import { IServerPaginationProps } from 'types/pagination';
import { getFormattedDate } from 'utils/Utils';

interface IPortalSubmissionsContainerProps extends IServerPaginationProps {
  rows: SubmissionRecordWithSecurityAndRootFeature[];
  rowCount: number;
  onRowClick: (submissionId: number) => void;
  searchTerm: string;
  onSearch: (term: string) => void;
}

const securityColorMap: Record<string, 'success' | 'warning' | 'error'> = {
  UNSECURED: 'success',
  PUBLISHED: 'success',
  PENDING: 'warning',
  SECURED: 'error',
  REJECTED: 'error'
};

const columns: GridColDef<SubmissionRecordWithSecurityAndRootFeature>[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    minWidth: 320
  },
  {
    field: 'security',
    headerName: 'Status',
    width: 180,
    sortable: false,
    renderCell: (params) => (
      <Chip
        label={SECURITY_LABEL[params.row.security] ?? params.row.security}
        size="small"
        color={securityColorMap[params.row.security] ?? 'default'}
        sx={{ fontWeight: 700 }}
      />
    )
  },
  {
    field: 'submitted_timestamp',
    headerName: 'Date',
    width: 160,
    valueGetter: (_value, row) => getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, row.submitted_timestamp)
  }
];

/**
 * Portal submissions container using a shared page section wrapper.
 *
 * @param {IPortalSubmissionsContainerProps} props
 * @return {*}
 */
export const PortalSubmissionsContainer = (props: IPortalSubmissionsContainerProps) => {
  const {
    rows,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    onRowClick,
    searchTerm,
    onSearch
  } = props;

  return (
    <PageSection
      id="portal-submissions"
      label={
        <>
          Submissions{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </>
      }
      headerContent={
        <Stack gap={1} direction="row" alignItems="center">
          <TextField
            size="small"
            placeholder="Search by submission name"
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
      <ServerPaginatedDataGrid<SubmissionRecordWithSecurityAndRootFeature>
        dataTestId="portal-submissions-table"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.submission_id}
        rowCount={rowCount}
        paginationModel={paginationModel}
        setPaginationModel={setPaginationModel}
        sortModel={sortModel}
        setSortModel={setSortModel}
        noRowsMessage="No submissions found."
        onRowClick={(row) => onRowClick(row.submission_id)}
      />
    </PageSection>
  );
};
