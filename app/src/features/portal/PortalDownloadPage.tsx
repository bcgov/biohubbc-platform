import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { DownloadRecord, DownloadListResponse } from 'interfaces/useDownloadApi.interface';
import { useNavigate } from 'react-router-dom';
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
  const downloads = useServerPaginatedDataGrid<DownloadRecord, DownloadListResponse>({
    fetcher: (_search, pagination) => api.download.getDownloads(pagination),
    extractData: (response) => response.downloads,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'create_date', sort: 'desc' }
  });

  return (
    <PortalListPageLayout>
      <PortalDownloadsContainer
        rows={downloads.rows}
        rowCount={downloads.rowCount}
        paginationModel={downloads.paginationModel}
        setPaginationModel={downloads.handlePaginationChange}
        sortModel={downloads.sortModel}
        setSortModel={downloads.handleSortChange}
        onRowClick={(downloadId) => navigate(`/download/${downloadId}`)}
      />
    </PortalListPageLayout>
  );
};
