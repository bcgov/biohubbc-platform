import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageSection } from 'components/section/PageSection';
import { useDialogContext } from 'hooks/useContext';
import { IBoardDetail, IBoardSwimlane, IBoardSwimlaneRequest } from 'interfaces/useBoardsApi.interface';
import { useState } from 'react';
import { SwimlaneDialog } from '../dialog/SwimlaneDialog';
import { ISwimlaneFormValues } from '../form/SwimlaneForm';
import { useCreateBoardSwimlaneMutation } from '../hooks/useCreateBoardSwimlaneMutation';
import { useDeleteBoardSwimlaneMutation } from '../hooks/useDeleteBoardSwimlaneMutation';
import { useUpdateBoardSwimlaneMutation } from '../hooks/useUpdateBoardSwimlaneMutation';
import { useUpdateBoardSwimlaneOrderMutation } from '../hooks/useUpdateBoardSwimlaneOrderMutation';
import { AdminBoardSettingsSwimlaneRow } from './AdminBoardSettingsSwimlaneRow';

interface IAdminBoardSettingsSwimlanesProps {
  board: IBoardDetail;
}

/**
 * Builds the swimlane request body from the swimlane dialog's values.
 *
 * @param {ISwimlaneFormValues} values The dialog's values.
 * @returns {IBoardSwimlaneRequest} The request body.
 */
const toSwimlaneRequest = (values: ISwimlaneFormValues): IBoardSwimlaneRequest => ({
  name: values.name.trim(),
  description: values.description?.trim() || null,
  color: values.color,
  isVisible: values.isVisible,
  boardTagIds: values.tags.map((tag) => tag.board_tag_id)
});

/**
 * Swimlanes section of the board settings: every lane in board order, hidden ones included, with add, edit, delete,
 * visibility and reordering. Visibility and order changes show before they are saved; adds and edits save from a
 * dialog that keeps any error. Each saved change is written to the board's lanes, or reloads them once the board's
 * overlapping changes settle, and refreshes the board's tickets.
 *
 * @param {IAdminBoardSettingsSwimlanesProps} props The board.
 * @returns {JSX.Element} The swimlanes section.
 */
export const AdminBoardSettingsSwimlanes = (props: IAdminBoardSettingsSwimlanesProps) => {
  const { board } = props;
  const dialogContext = useDialogContext();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSwimlane, setEditingSwimlane] = useState<IBoardSwimlane | undefined>();

  const updateSwimlaneMutation = useUpdateBoardSwimlaneMutation(board.board_id);
  const updateSwimlaneOrderMutation = useUpdateBoardSwimlaneOrderMutation(board.board_id);
  const createSwimlaneMutation = useCreateBoardSwimlaneMutation(board.board_id);
  const deleteSwimlaneMutation = useDeleteBoardSwimlaneMutation(board.board_id);

  /**
   * Opens the swimlane dialog to edit a lane, or to add one, clearing any earlier save error.
   *
   * @param {IBoardSwimlane} [swimlane] The lane to edit; omitted to add a lane.
   * @returns {void}
   */
  const openDialog = (swimlane?: IBoardSwimlane) => {
    createSwimlaneMutation.reset();
    updateSwimlaneMutation.reset();
    setEditingSwimlane(swimlane);
    setIsDialogOpen(true);
  };

  /**
   * Closes the swimlane dialog and clears the lane it was editing.
   *
   * @returns {void}
   */
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingSwimlane(undefined);
  };

  /**
   * Saves the dialog's swimlane: edits the lane being edited, or adds a lane to the end of the board. The dialog
   * closes once saved.
   *
   * @param {ISwimlaneFormValues} values The dialog's values.
   * @returns {void}
   */
  const handleSaveSwimlane = (values: ISwimlaneFormValues) => {
    if (!editingSwimlane) {
      createSwimlaneMutation.mutate(toSwimlaneRequest(values), { onSuccess: closeDialog });
      return;
    }

    const swimlane: IBoardSwimlane = {
      ...editingSwimlane,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      color: values.color,
      is_visible: values.isVisible,
      tags: values.tags
    };
    updateSwimlaneMutation.mutate(swimlane, { onSuccess: closeDialog });
  };

  /**
   * Moves a lane one place within the board's order and saves the full order.
   *
   * @param {number} index The lane's current position.
   * @param {number} offset -1 to move it left (up the list), 1 to move it right (down the list).
   * @returns {void}
   */
  const handleMoveSwimlane = (index: number, offset: -1 | 1) => {
    const swimlanes = [...board.swimlanes];
    const [moved] = swimlanes.splice(index, 1);
    swimlanes.splice(index + offset, 0, moved);
    updateSwimlaneOrderMutation.mutate(swimlanes);
  };

  /**
   * Asks for confirmation before deleting a lane. Its tickets stay on the board, in other lanes or unsorted.
   *
   * @param {IBoardSwimlane} swimlane The lane to delete.
   * @returns {void}
   */
  const handleDeleteSwimlane = (swimlane: IBoardSwimlane) => {
    const closeConfirmation = () => dialogContext.setYesNoDialog({ open: false });

    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete swimlane?',
      dialogContent: (
        <Typography component="div" color="textSecondary">
          Deleting swimlane <strong>{swimlane.name}</strong> cannot be undone. Its tickets stay on the board. Are you
          sure you want to proceed?
        </Typography>
      ),
      yesButtonLabel: 'Delete Swimlane',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: closeConfirmation,
      onNo: closeConfirmation,
      onYes: () => {
        closeConfirmation();
        deleteSwimlaneMutation.mutate(swimlane);
      }
    });
  };

  const saveError = createSwimlaneMutation.error?.message ?? updateSwimlaneMutation.error?.message;

  return (
    <>
      <PageSection id="board-swimlanes" label="Swimlanes" onAdd={() => openDialog()} addLabel="New Swimlane">
        <Stack gap={1} sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Lanes show left to right on the board after &quot;Unsorted&quot;. Hidden lanes are left off the board.
          </Typography>
          {board.swimlanes.map((swimlane, index) => (
            <AdminBoardSettingsSwimlaneRow
              key={swimlane.board_swimlane_id}
              swimlane={swimlane}
              isFirst={index === 0}
              isLast={index === board.swimlanes.length - 1}
              onMoveUp={() => handleMoveSwimlane(index, -1)}
              onMoveDown={() => handleMoveSwimlane(index, 1)}
              onVisibilityChange={(isVisible) => updateSwimlaneMutation.mutate({ ...swimlane, is_visible: isVisible })}
              onEdit={() => openDialog(swimlane)}
              onDelete={() => handleDeleteSwimlane(swimlane)}
            />
          ))}
          {board.swimlanes.length ? null : (
            <Typography variant="body2" color="text.secondary">
              No swimlanes
            </Typography>
          )}
        </Stack>
      </PageSection>

      <SwimlaneDialog
        open={isDialogOpen}
        swimlane={editingSwimlane}
        boardTags={board.tags}
        isLoading={createSwimlaneMutation.isPending || updateSwimlaneMutation.isPending}
        dialogError={isDialogOpen ? saveError : undefined}
        onCancel={closeDialog}
        onSave={handleSaveSwimlane}
      />
    </>
  );
};
