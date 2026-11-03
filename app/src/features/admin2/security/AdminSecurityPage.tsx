import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { CategoriesContainer } from 'features/admin/security/components/CategoriesContainer';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { Link as RouterLink } from 'react-router-dom';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { securityQueryKeys } from 'utils/query-keys/security-query-keys';

/**
 * Administrative security page: the security categories. Each category opens its own page, which lists the rules
 * filed under it. The table keeps its page, sort and search as local state and loads the matching page through a
 * query.
 *
 * @returns {JSX.Element} Security categories table.
 */
export const AdminSecurityPage = () => {
  const biohubApi = useApi();
  const queryClient = useQueryClient();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const search = { search: grid.debouncedSearchTerm };
  const categoriesQuery = useQuery({
    queryKey: securityQueryKeys.categories(search, grid.apiPagination),
    queryFn: ({ signal }) => biohubApi.security.getSecurityCategories(search, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  /**
   * Reloads the categories, and the rules that show their category, after a category changes, and refreshes the
   * reviews that apply rules.
   *
   * @returns {void}
   */
  const refreshSecurity = () => refreshChangedQueries(queryClient, changedQueryKeys.securityRule());

  return (
    <AdminPageLayout
      title="Security"
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
      tabs={[{ value: 'categories', label: 'Categories', id: 'security-categories', ariaControls: 'security-panel' }]}
      activeTab="categories"
      onTabChange={() => {}}>
      <Box id="security-panel" role="tabpanel" aria-labelledby="security-categories">
        <QueryErrorDialog error={categoriesQuery.error} label="security categories" />
        <CategoriesContainer
          categories={categoriesQuery.data?.categories ?? []}
          rowCount={categoriesQuery.data?.pagination.total ?? 0}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          refresh={refreshSecurity}
          searchTerm={grid.searchTerm}
          onSearch={grid.handleSearch}
        />
      </Box>
    </AdminPageLayout>
  );
};
