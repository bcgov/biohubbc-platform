import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useNavigate } from 'react-router-dom';
import { downloadQueryKeys } from 'utils/query-keys/download-query-keys';
import { PortalListPageLayout } from './components/PortalListPageLayout';
import { PortalDownloadsContainer } from './list/PortalDownloadsContainer';

/**
 * Renders downloads available through the current user's active team memberships.
 *
 * @return {JSX.Element} The current user's paginated downloads table.
 */
export const PortalDownloadPage = () => {
  const api = useApi();
  const navigate = useNavigate();
  const downloadsGrid = useServerPaginatedGridState({ defaultSort: { field: 'create_date', sort: 'desc' } });
  const downloadsQuery = useQuery({
    queryKey: downloadQueryKeys.list(downloadsGrid.apiPagination),
    queryFn: ({ signal }) => api.download.getDownloads(downloadsGrid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  return (
    <PortalListPageLayout>
      <QueryErrorDialog error={downloadsQuery.error} label="downloads" />
      <PortalDownloadsContainer
        rows={downloadsQuery.data?.downloads ?? []}
        rowCount={downloadsQuery.data?.pagination.total ?? 0}
        paginationModel={downloadsGrid.paginationModel}
        setPaginationModel={downloadsGrid.handlePaginationChange}
        sortModel={downloadsGrid.sortModel}
        setSortModel={downloadsGrid.handleSortChange}
        onRowClick={(downloadId) => navigate(`/download/${downloadId}`)}
      />
    </PortalListPageLayout>
  );
};
