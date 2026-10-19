import { mdiCogOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { skipToken, useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useApi } from 'hooks/useApi';
import { IBoardTicketsQueryParams } from 'interfaces/useBoardsApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useState } from 'react';
import { Navigate, Link as RouterLink, useParams } from 'react-router-dom';
import { keepPreviousDataWithin } from 'utils/query-client';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { AdminBoardLanes } from './content/AdminBoardLanes';
import { AdminBoardLanesSkeleton } from './skeleton/AdminBoardLanesSkeleton';

/**
 * Administrative board view: the board's tickets in columns, "Unsorted" first, then each visible lane. Closed
 * tickets are left out unless "Include closed" is on; toggling it keeps the current columns on screen while the
 * other set loads.
 *
 * @returns {JSX.Element} The board page.
 */
export const AdminBoardPage = () => {
  const api = useApi();
  const { boardId } = useParams<{ boardId: string }>();
  const [includeClosed, setIncludeClosed] = useState(false);

  const params: IBoardTicketsQueryParams = { include_closed: includeClosed };
  const boardTicketsQuery = useQuery({
    queryKey: boardQueryKeys.tickets(boardId ?? '', params),
    queryFn: boardId ? ({ signal }) => api.boards.getBoardTickets(boardId, params, { signal }) : skipToken,
    placeholderData: keepPreviousDataWithin(boardQueryKeys.ticketsForBoard(boardId ?? ''))
  });

  if (!boardId) {
    return <Navigate to="/page-not-found" replace />;
  }

  const boardTickets = boardTicketsQuery.data;
  const board = boardTickets?.board;

  return (
    <AdminPageLayout
      title={board?.name ?? <Skeleton variant="text" width={240} />}
      description={board?.description}
      descriptionDialogTitle="Board description"
      breadcrumbs={
        <Breadcrumbs aria-label="board breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Link component={RouterLink} to="/admin/boards" underline="hover" color="inherit">
            Boards
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            {board?.name ?? 'Board'}
          </Typography>
        </Breadcrumbs>
      }
      buttons={
        <Stack direction="row" alignItems="center" gap={2}>
          <FormControlLabel
            label="Include closed"
            control={<Switch checked={includeClosed} onChange={(event) => setIncludeClosed(event.target.checked)} />}
          />
          <Button
            variant="outlined"
            component={RouterLink}
            to={`/admin/boards/${boardId}/settings`}
            startIcon={<Icon path={mdiCogOutline} size={0.8} />}>
            Settings
          </Button>
        </Stack>
      }
      tabs={[{ value: 'board', label: 'Board', id: 'board-tab', ariaControls: 'board-panel' }]}
      activeTab="board"
      onTabChange={() => {}}>
      <Box id="board-panel" role="tabpanel" aria-labelledby="board-tab">
        <QueryErrorDialog error={boardTicketsQuery.error} label="board" />
        <LoadingGuard isLoading={!boardTickets} isLoadingFallback={<AdminBoardLanesSkeleton />}>
          {boardTickets ? <AdminBoardLanes boardTickets={boardTickets} /> : null}
        </LoadingGuard>
      </Box>
    </AdminPageLayout>
  );
};
