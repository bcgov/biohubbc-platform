import Box from '@mui/material/Box';
import { PageHeader } from 'components/header/PageHeader';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { CategoriesContainer } from './components/CategoriesContainer';
import { ReasonsContainer } from './components/ReasonsContainer';

/**
 * Admin page for viewing security categories and reasons.
 *
 * @returns {*}
 */
export const ManageSecurityPage = () => {
  const biohubApi = useApi();

  const categories = useServerPaginatedDataGrid({
    fetcher: (search, pagination) => biohubApi.security.getSecurityCategories({ search }, pagination),
    extractData: (response) => response.categories,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });

  const reasons = useServerPaginatedDataGrid({
    fetcher: (search, pagination) => biohubApi.security.getSecurityReasons({ search }, pagination),
    extractData: (response) => response.reasons,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });

  return (
    <>
      <PageHeader label="Security" />
      <Box py={4}>
        <CategoriesContainer
          categories={categories.rows}
          rowCount={categories.rowCount}
          paginationModel={categories.paginationModel}
          setPaginationModel={categories.handlePaginationChange}
          sortModel={categories.sortModel}
          setSortModel={categories.handleSortChange}
          refresh={categories.refresh}
          searchTerm={categories.searchTerm}
          onSearch={categories.handleSearch}
        />

        <Box mt={4}>
          <ReasonsContainer
            reasons={reasons.rows}
            rowCount={reasons.rowCount}
            paginationModel={reasons.paginationModel}
            setPaginationModel={reasons.handlePaginationChange}
            sortModel={reasons.sortModel}
            setSortModel={reasons.handleSortChange}
            refresh={reasons.refresh}
            searchTerm={reasons.searchTerm}
            onSearch={reasons.handleSearch}
          />
        </Box>
      </Box>
    </>
  );
};
