import { useApi } from 'hooks/useApi';
import { useSubmissionsListPageState } from 'hooks/useSubmissionsListPageState';
import { useNavigate } from 'react-router-dom';
import { PortalListPageLayout } from './components/PortalListPageLayout';
import { PortalSubmissionsContainer } from './list/PortalSubmissionsContainer';

/**
 * Portal submissions page content for the current user.
 *
 * @return {*}
 */
export const PortalSubmissionPage = () => {
  const biohubApi = useApi();
  const navigate = useNavigate();
  const {
    rows,
    rowCount,
    paginationModel,
    handlePaginationChange,
    sortModel,
    handleSortChange,
    searchTerm,
    handleSearch
  } = useSubmissionsListPageState(biohubApi.submissions.getSubmissionsForUser);

  return (
    <PortalListPageLayout>
      <PortalSubmissionsContainer
        rows={rows}
        rowCount={rowCount}
        paginationModel={paginationModel}
        setPaginationModel={handlePaginationChange}
        sortModel={sortModel}
        setSortModel={handleSortChange}
        onRowClick={(submissionId) => navigate(`/portal/submission/${submissionId}`)}
        searchTerm={searchTerm}
        onSearch={handleSearch}
      />
    </PortalListPageLayout>
  );
};
