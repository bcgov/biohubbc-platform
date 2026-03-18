import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import Container from '@mui/material/Container';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { ISecurityReasonWithFeatureCount } from 'interfaces/useSecurityApi.interface';
import { IServerPaginationProps } from 'types/pagination';

export interface IReasonsContainerProps extends IServerPaginationProps {
  reasons: ISecurityReasonWithFeatureCount[];
  refresh: () => void;
  searchTerm: string;
  onSearch: (term: string) => void;
}

const columns: GridColDef<ISecurityReasonWithFeatureCount>[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    minWidth: 150
  },
  {
    field: 'description',
    headerName: 'Description',
    flex: 2,
    minWidth: 200
  },
  {
    field: 'feature_count',
    headerName: 'Features',
    width: 120,
    align: 'center',
    headerAlign: 'center'
  }
];

export const ReasonsContainer = (props: IReasonsContainerProps) => {
  const { reasons, rowCount, paginationModel, setPaginationModel, sortModel, setSortModel } = props;

  return (
    <Container maxWidth="xl">
      <PageSection
        id="reasons"
        label={
          <>
            Reasons{' '}
            <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
              ({rowCount})
            </Typography>
          </>
        }
        headerContent={
          <Stack gap={1} direction="row" alignItems="center">
            <TextField
              size="small"
              placeholder="Search by reason name"
              value={props.searchTerm}
              onChange={(e) => props.onSearch(e.target.value)}
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
        <ServerPaginatedDataGrid<ISecurityReasonWithFeatureCount>
          dataTestId="reasons-table"
          rows={reasons}
          columns={columns}
          getRowId={(row) => row.security_rule_id}
          noRowsMessage="No Reasons"
          rowCount={rowCount}
          paginationModel={paginationModel}
          setPaginationModel={setPaginationModel}
          sortModel={sortModel}
          setSortModel={setSortModel}
        />
      </PageSection>
    </Container>
  );
};
