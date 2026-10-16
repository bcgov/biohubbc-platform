import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { RulesContainer } from 'features/admin/security/components/RulesContainer';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { securityQueryKeys } from 'utils/query-keys/security-query-keys';
import { AdminSecurityCategoryAbout } from './AdminSecurityCategoryAbout';

interface AdminSecurityCategoryPageContentProps {
  securityCategoryId: number;
}

/**
 * Shows one security category in the administrative page layout, with the rules filed under it in a Rules tab and
 * its description and creation details in an About tab. The rules table stays mounted behind the About tab, so
 * returning to it keeps its page, sort and search.
 * The rules table keeps its page, sort and search as local state and loads the matching page through a query.
 *
 * @param {AdminSecurityCategoryPageContentProps} props The category to show.
 * @returns {JSX.Element} Category header and its rules table.
 */
export const AdminSecurityCategoryPageContent = ({ securityCategoryId }: AdminSecurityCategoryPageContentProps) => {
  const biohubApi = useApi();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'rules' | 'about'>('rules');

  const categoryQuery = useQuery({
    queryKey: securityQueryKeys.category(securityCategoryId),
    queryFn: ({ signal }) => biohubApi.security.getSecurityCategory(securityCategoryId, { signal })
  });
  const category = categoryQuery.data;

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const search = { search: grid.debouncedSearchTerm, security_category_id: securityCategoryId };
  const rulesQuery = useQuery({
    queryKey: securityQueryKeys.rules(search, grid.apiPagination),
    queryFn: ({ signal }) => biohubApi.security.getSecurityRules(search, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  /**
   * Reloads the rules, and the categories that count them, after a rule changes, and refreshes the reviews that
   * apply rules.
   *
   * @returns {void}
   */
  const refreshSecurity = () => refreshChangedQueries(queryClient, changedQueryKeys.securityRule());

  if (isAxiosError(categoryQuery.error) && categoryQuery.error.response?.status === 404) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <AdminPageLayout
      title={categoryQuery.isPending ? <Skeleton width={240} height={48} /> : (category?.name ?? 'Category')}
      breadcrumbs={
        <Breadcrumbs aria-label="security category breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Link component={RouterLink} to="/admin/security" underline="hover" color="inherit">
            Security
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            {category?.name ?? 'Category'}
          </Typography>
        </Breadcrumbs>
      }
      tabs={[
        {
          value: 'rules',
          label: 'Rules',
          id: 'security-category-rules-tab',
          ariaControls: 'security-category-rules-panel'
        },
        {
          value: 'about',
          label: 'About',
          id: 'security-category-about-tab',
          ariaControls: 'security-category-about-panel'
        }
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}>
      <QueryErrorDialog error={categoryQuery.error} label="security category" />
      <Box
        role="tabpanel"
        id="security-category-rules-panel"
        aria-labelledby="security-category-rules-tab"
        hidden={activeTab !== 'rules'}>
        <QueryErrorDialog error={rulesQuery.error} label="security rules" />
        <RulesContainer
          rules={rulesQuery.data?.reasons ?? []}
          rowCount={rulesQuery.data?.pagination.total ?? 0}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          refresh={refreshSecurity}
          searchTerm={grid.searchTerm}
          onSearch={grid.handleSearch}
          securityCategoryId={securityCategoryId}
        />
      </Box>
      {activeTab === 'about' && category && (
        <Box role="tabpanel" id="security-category-about-panel" aria-labelledby="security-category-about-tab">
          <AdminSecurityCategoryAbout category={category} />
        </Box>
      )}
    </AdminPageLayout>
  );
};
