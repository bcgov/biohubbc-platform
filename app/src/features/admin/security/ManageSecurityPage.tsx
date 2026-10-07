import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import Box from '@mui/material/Box';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from 'components/header/PageHeader';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { securityQueryKeys } from 'utils/query-keys/security-query-keys';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { CategoriesContainer } from './components/CategoriesContainer';
import { ReasonsContainer } from './components/ReasonsContainer';

/**
 * Admin page for managing security categories and reasons.
 *
 * Each table loads the page on screen through a query; a container's `refresh` reloads every page of its table.
 *
 * @returns {*}
 */
export const ManageSecurityPage = () => {
  const biohubApi = useApi();
  const queryClient = useQueryClient();

  const categoriesGrid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const categoriesSearch = { search: categoriesGrid.debouncedSearchTerm };
  const categoriesQuery = useQuery({
    queryKey: securityQueryKeys.categories(categoriesSearch, categoriesGrid.apiPagination),
    queryFn: ({ signal }) =>
      biohubApi.security.getSecurityCategories(categoriesSearch, categoriesGrid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  const reasonsGrid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const reasonsSearch = { search: reasonsGrid.debouncedSearchTerm };
  const reasonsQuery = useQuery({
    queryKey: securityQueryKeys.reasons(reasonsSearch, reasonsGrid.apiPagination),
    queryFn: ({ signal }) =>
      biohubApi.security.getSecurityReasons(reasonsSearch, reasonsGrid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  /**
   * Reloads both tables after a category or reason changes, since reasons show their category, and refreshes the
   * reviews that show reasons as rules.
   *
   * @returns {void}
   */
  const refreshSecurity = () => refreshChangedQueries(queryClient, changedQueryKeys.securityReason());

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs aria-label="security breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              Security
            </Typography>
          </Breadcrumbs>
        }
        label="Manage Security"
      />
      <Box py={4}>
        <QueryErrorDialog error={categoriesQuery.error} label="security categories" />
        <CategoriesContainer
          categories={categoriesQuery.data?.categories ?? []}
          rowCount={categoriesQuery.data?.pagination.total ?? 0}
          paginationModel={categoriesGrid.paginationModel}
          setPaginationModel={categoriesGrid.handlePaginationChange}
          sortModel={categoriesGrid.sortModel}
          setSortModel={categoriesGrid.handleSortChange}
          refresh={refreshSecurity}
          searchTerm={categoriesGrid.searchTerm}
          onSearch={categoriesGrid.handleSearch}
        />

        <Box mt={4}>
          <QueryErrorDialog error={reasonsQuery.error} label="security reasons" />
          <ReasonsContainer
            reasons={reasonsQuery.data?.reasons ?? []}
            rowCount={reasonsQuery.data?.pagination.total ?? 0}
            paginationModel={reasonsGrid.paginationModel}
            setPaginationModel={reasonsGrid.handlePaginationChange}
            sortModel={reasonsGrid.sortModel}
            setSortModel={reasonsGrid.handleSortChange}
            refresh={refreshSecurity}
            searchTerm={reasonsGrid.searchTerm}
            onSearch={reasonsGrid.handleSearch}
          />
        </Box>
      </Box>
    </>
  );
};
