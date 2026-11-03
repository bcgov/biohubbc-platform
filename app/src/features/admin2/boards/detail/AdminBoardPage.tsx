import { mdiPencil } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { skipToken, useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useState } from 'react';
import { Navigate, Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { BoardDialog } from '../dialog/BoardDialog';
import { IBoardFormValues } from '../form/BoardForm';
import { useSaveBoardMutation } from '../hooks/useSaveBoardMutation';
import { AdminBoardSwimlanesContent } from './content/AdminBoardSwimlanesContent';
import { AdminBoardTagsContent } from './content/AdminBoardTagsContent';
import { AdminBoardTicketsContent } from './content/AdminBoardTicketsContent';

type BoardTab = 'tickets' | 'swimlanes' | 'tags';

const BOARD_TABS: BoardTab[] = ['tickets', 'swimlanes', 'tags'];

/**
 * Administrative board page: the tickets on the board as a kanban of its swimlanes, the board's swimlanes, and the tags
 * that put tickets on the board, through URL-addressable tabs. Only the selected tab's content is mounted, so only it loads. The board's name and description
 * are edited from the header.
 *
 * @returns {JSX.Element} The board page.
 */
export const AdminBoardPage = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = BOARD_TABS.find((tab) => tab === searchParams.get('tab')) ?? 'tickets';
  const [isBoardDialogOpen, setIsBoardDialogOpen] = useState(false);

  const boardQuery = useQuery({
    queryKey: boardQueryKeys.detail(boardId ?? ''),
    queryFn: boardId ? ({ signal }) => api.boards.getBoard(boardId, { signal }) : skipToken
  });
  const saveBoardMutation = useSaveBoardMutation();

  if (!boardId) {
    return <Navigate to="/page-not-found" replace />;
  }

  const board = boardQuery.data;

  /**
   * Closes the board dialog and clears its last error.
   *
   * @returns {void}
   */
  const closeBoardDialog = () => {
    setIsBoardDialogOpen(false);
    saveBoardMutation.reset();
  };

  /**
   * Saves the board's name, description and tags, closing the dialog once saved; a failure stays in the dialog.
   *
   * @param {IBoardFormValues} values The dialog's values.
   * @returns {void}
   */
  const handleSaveBoard = (values: IBoardFormValues) => {
    saveBoardMutation.mutate(
      { boardId, values },
      {
        onSuccess: (savedBoard) => {
          dialogContext.setSnackbar({ open: true, snackbarMessage: `Updated board ${savedBoard.name}` });
          closeBoardDialog();
        }
      }
    );
  };

  return (
    <>
      <AdminPageLayout
        title={board?.name ?? <Skeleton variant="text" width={240} />}
        description={board?.description}
        descriptionDialogTitle="Board description"
        breadcrumbs={
          <Breadcrumbs aria-label="board breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Link component={RouterLink} to="/admin/tickets" underline="hover" color="inherit">
              Tickets
            </Link>
            <Link component={RouterLink} to="/admin/tickets?tab=boards" underline="hover" color="inherit">
              Boards
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              {board?.name ?? 'Board'}
            </Typography>
          </Breadcrumbs>
        }
        buttons={
          <Button
            variant="outlined"
            disabled={!board}
            onClick={() => setIsBoardDialogOpen(true)}
            startIcon={<Icon path={mdiPencil} size={0.8} />}>
            Edit Board
          </Button>
        }
        tabs={[
          { value: 'tickets', label: 'Tickets', id: 'board-tab-tickets', ariaControls: 'board-panel' },
          { value: 'swimlanes', label: 'Swimlanes', id: 'board-tab-swimlanes', ariaControls: 'board-panel' },
          { value: 'tags', label: 'Tags', id: 'board-tab-tags', ariaControls: 'board-panel' }
        ]}
        activeTab={activeTab}
        onTabChange={(value) => {
          const next = new URLSearchParams(searchParams);
          next.set('tab', value);
          setSearchParams(next);
        }}>
        <QueryErrorDialog error={boardQuery.error} label="board" />
        <Box id="board-panel" role="tabpanel" aria-labelledby={`board-tab-${activeTab}`}>
          {activeTab === 'tickets' && <AdminBoardTicketsContent boardId={boardId} />}
          {activeTab === 'swimlanes' && <AdminBoardSwimlanesContent boardId={boardId} />}
          {activeTab === 'tags' && <AdminBoardTagsContent boardId={boardId} />}
        </Box>
      </AdminPageLayout>

      <BoardDialog
        open={isBoardDialogOpen}
        board={board}
        isLoading={saveBoardMutation.isPending}
        dialogError={saveBoardMutation.error?.message}
        onCancel={closeBoardDialog}
        onSave={handleSaveBoard}
      />
    </>
  );
};
