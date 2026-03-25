import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import {
  IGetSubmissionsForUserResponse,
  SubmissionRecordWithSecurityAndRootFeature
} from 'interfaces/useSubmissionsApi.interface';

type SubmissionListFetcher = (params: {
  search: string;
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}) => Promise<IGetSubmissionsForUserResponse>;

const DEFAULT_PAGE_SIZE = 10;

/**
 * Shared server-backed submission list state for portal pages.
 *
 * @param {SubmissionListFetcher} fetchSubmissions
 * @returns {*}
 */
export const useSubmissionsListPageState = (fetchSubmissions: SubmissionListFetcher) => {
  return useServerPaginatedDataGrid<SubmissionRecordWithSecurityAndRootFeature, IGetSubmissionsForUserResponse>({
    fetcher: (search, pagination) => fetchSubmissions({ search, ...pagination }),
    extractData: (response) => response.submissions,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'submitted_timestamp', sort: 'desc' },
    defaultPageSize: DEFAULT_PAGE_SIZE
  });
};
