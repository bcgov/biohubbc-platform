import { mdiViewColumnOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { skipToken, useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useState } from 'react';
import { Navigate, Link as RouterLink, useParams } from 'react-router-dom';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { BoardDialog } from '../dialog/BoardDialog';
import { IBoardFormValues } from '../form/BoardForm';
import { useSaveBoardMutation } from '../hooks/useSaveBoardMutation';
import { AdminBoardSettingsDetails } from './content/AdminBoardSettingsDetails';
import { AdminBoardSettingsSwimlanes } from './content/AdminBoardSettingsSwimlanes';
import { AdminBoardSettingsSkeleton } from './skeleton/AdminBoardSettingsSkeleton';

/**
 * Administrative board settings page: the board's name, description, color and tags, and its swimlanes, hidden ones
 * included, with their visibility, tags and order.
 *
 * @returns {JSX.Element} The board settings page.
 */
export const AdminBoardSettingsPage = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { boardId } = useParams<{ boardId: string }>();
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
   * Saves the board's name, description, color and tags, closing the dialog once saved.
   *
   * @param {IBoardFormValues} values The dialog's values.
   * @returns {void}
   */
  const handleSaveBoard = (values: IBoardFormValues) => {
    saveBoardMutation.mutate(
      { boardId, values },
      {
        onSuccess: (savedBoard) => {
          setIsBoardDialogOpen(false);
          dialogContext.setSnackbar({ open: true, snackbarMessage: `Updated board ${savedBoard.name}` });
        }
      }
    );
  };

  return (
    <>
      <AdminPageLayout
        title={board ? `${board.name} Settings` : <Skeleton variant="text" width={240} />}
        breadcrumbs={
          <Breadcrumbs aria-label="board settings breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Link component={RouterLink} to="/admin/boards" underline="hover" color="inherit">
              Boards
            </Link>
            <Link component={RouterLink} to={`/admin/boards/${boardId}`} underline="hover" color="inherit">
              {board?.name ?? 'Board'}
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              Settings
            </Typography>
          </Breadcrumbs>
        }
        buttons={
          <Button
            variant="outlined"
            component={RouterLink}
            to={`/admin/boards/${boardId}`}
            startIcon={<Icon path={mdiViewColumnOutline} size={0.8} />}>
            View Board
          </Button>
        }
        tabs={[
          { value: 'settings', label: 'Settings', id: 'board-settings-tab', ariaControls: 'board-settings-panel' }
        ]}
        activeTab="settings"
        onTabChange={() => {}}>
        <Box id="board-settings-panel" role="tabpanel" aria-labelledby="board-settings-tab">
          <QueryErrorDialog error={boardQuery.error} label="board" />
          <LoadingGuard isLoading={!board} isLoadingFallback={<AdminBoardSettingsSkeleton />}>
            {board ? (
              <Stack gap={3}>
                <AdminBoardSettingsDetails
                  board={board}
                  onEdit={() => {
                    saveBoardMutation.reset();
                    setIsBoardDialogOpen(true);
                  }}
                />
                <AdminBoardSettingsSwimlanes board={board} />
              </Stack>
            ) : null}
          </LoadingGuard>
        </Box>
      </AdminPageLayout>

      <BoardDialog
        open={isBoardDialogOpen}
        board={board}
        isLoading={saveBoardMutation.isPending}
        dialogError={saveBoardMutation.error?.message}
        onCancel={() => setIsBoardDialogOpen(false)}
        onSave={handleSaveBoard}
      />
    </>
  );
};
