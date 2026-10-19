import Typography from '@mui/material/Typography';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { AdminTagsTable } from 'features/admin2/tags/table/AdminTagsTable';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ITagsQueryParams } from 'interfaces/useTagsApi.interface';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';

interface IAdminBoardTagsContentProps {
  /** The board whose tags are listed. */
  boardId: string;
}

/**
 * Tags tab of a board's page: the server-paginated list of the board's tags, which decide the tickets on the board.
 * The board's tags are changed by editing the board; tags themselves are managed on the tickets page's Tags tab.
 *
 * @param {IAdminBoardTagsContentProps} props The board whose tags are listed.
 * @returns {JSX.Element} The board's tags table.
 */
export const AdminBoardTagsContent = (props: IAdminBoardTagsContentProps) => {
  const { boardId } = props;
  const api = useApi();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const listParams: ITagsQueryParams = { board_id: boardId, ...grid.apiPagination };
  const tagsQuery = useQuery({
    queryKey: tagQueryKeys.list(listParams),
    queryFn: ({ signal }) => api.tags.getTags(listParams, { signal }),
    placeholderData: keepPreviousData
  });

  const rowCount = tagsQuery.data?.pagination.total ?? 0;

  return (
    <>
      <QueryErrorDialog error={tagsQuery.error} label="board tags" />
      <PageSection
        id="board-tags"
        label={
          <>
            Tags{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </>
        }>
        <AdminTagsTable
          tags={tagsQuery.data?.tags ?? []}
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
        />
      </PageSection>
    </>
  );
};
