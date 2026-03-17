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
import { ISecurityCategoryWithRuleCount } from 'interfaces/useSecurityApi.interface';
import { IServerPaginationProps } from 'types/pagination';

export interface ICategoriesContainerProps extends IServerPaginationProps {
  categories: ISecurityCategoryWithRuleCount[];
  refresh: () => void;
  searchTerm: string;
  onSearch: (term: string) => void;
}

const columns: GridColDef<ISecurityCategoryWithRuleCount>[] = [
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
    minWidth: 200,
    valueGetter: (value) => value || '-'
  },
  {
    field: 'rule_count',
    headerName: 'Reasons',
    width: 120,
    align: 'center',
    headerAlign: 'center'
  }
];

export const CategoriesContainer = (props: ICategoriesContainerProps) => {
  const { categories, rowCount, paginationModel, setPaginationModel, sortModel, setSortModel } = props;

  return (
    <Container maxWidth="xl">
      <PageSection
        id="categories"
        label={
          <>
            Categories{' '}
            <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
              ({rowCount})
            </Typography>
          </>
        }
        headerContent={
          <Stack gap={1} direction="row" alignItems="center">
            <TextField
              size="small"
              placeholder="Search by category name"
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
        <ServerPaginatedDataGrid<ISecurityCategoryWithRuleCount>
          dataTestId="categories-table"
          rows={categories}
          columns={columns}
          getRowId={(row) => row.security_category_id}
          noRowsMessage="No Categories"
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
