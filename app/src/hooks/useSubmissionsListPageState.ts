import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import {
  IGetSubmissionsForUserResponse,
  SubmissionFilters,
  SubmissionRecordWithSecurityAndRootFeature
} from 'interfaces/useSubmissionsApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

type SubmissionListFetcher = (
  filters?: SubmissionFilters,
  pagination?: ApiPaginationRequestOptions
) => Promise<IGetSubmissionsForUserResponse>;

const DEFAULT_PAGE_SIZE = 10;

/**
 * Shared server-backed submission list state for portal pages.
 *
 * @param {SubmissionListFetcher} fetchSubmissions
 * @returns {*}
 */
export const useSubmissionsListPageState = (fetchSubmissions: SubmissionListFetcher) => {
  return useServerPaginatedDataGrid<SubmissionRecordWithSecurityAndRootFeature, IGetSubmissionsForUserResponse>({
    fetcher: (search, pagination) => fetchSubmissions({ search }, pagination),
    extractData: (response) => response.submissions,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'submitted_timestamp', sort: 'desc' },
    defaultPageSize: DEFAULT_PAGE_SIZE
  });
};
