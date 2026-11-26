import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SUBMISSIONS_LIST_DEFAULT_SORT } from 'constants/submission';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useNavigate } from 'react-router-dom';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { PortalPageLayout } from 'layouts/PortalPageLayout';
import { PortalSubmissionsContent } from './content/PortalSubmissionsContent';

/**
 * Portal submissions page: the submissions of the current user, each opening its own page.
 *
 * @return {JSX.Element} The submissions header and table.
 */
export const PortalSubmissionsPage = () => {
  const biohubApi = useApi();
  const navigate = useNavigate();
  const grid = useServerPaginatedGridState({ defaultSort: SUBMISSIONS_LIST_DEFAULT_SORT });
  const filters = { search: grid.debouncedSearchTerm };
  const submissionsQuery = useQuery({
    queryKey: submissionQueryKeys.userList(filters, grid.apiPagination),
    queryFn: ({ signal }) => biohubApi.submissions.getSubmissionsForUser(filters, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  return (
    <PortalPageLayout title="Submissions">
      <QueryErrorDialog error={submissionsQuery.error} label="submissions" />
      <PortalSubmissionsContent
        rows={submissionsQuery.data?.submissions ?? []}
        rowCount={submissionsQuery.data?.pagination.total ?? 0}
        paginationModel={grid.paginationModel}
        setPaginationModel={grid.handlePaginationChange}
        sortModel={grid.sortModel}
        setSortModel={grid.handleSortChange}
        onRowClick={(submissionId) => navigate(`/portal/submission/${submissionId}`)}
        searchTerm={grid.searchTerm}
        onSearch={grid.handleSearch}
      />
    </PortalPageLayout>
  );
};
