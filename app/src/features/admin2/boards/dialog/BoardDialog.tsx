import { EditDialog } from 'components/dialog/EditDialog';
import { TAG_DEFAULT_COLOR } from 'constants/tag';
import { IBoardDetail, IBoardSummary } from 'interfaces/useBoardsApi.interface';
import { BoardForm, IBoardFormValues } from '../form/BoardForm';
import { BoardYupSchema } from '../form/BoardYupSchema';

interface IBoardDialogProps {
  open: boolean;
  /** The board being edited; omitted to create a board. */
  board?: IBoardSummary | IBoardDetail;
  isLoading: boolean;
  /** Error from the last save, such as a duplicate name, shown in the dialog. */
  dialogError?: string;
  onCancel: () => void;
  onSave: (values: IBoardFormValues) => void;
}

const CreateBoardFormInitialValues: IBoardFormValues = {
  name: '',
  description: null,
  color: TAG_DEFAULT_COLOR,
  tags: []
};

/**
 * Dialog for creating a board or editing one's name, description, color and tags, using the shared `EditDialog`.
 *
 * @param {IBoardDialogProps} props The board being edited, if any, and the save and cancel handlers.
 * @returns {JSX.Element} The board dialog.
 */
export const BoardDialog = (props: IBoardDialogProps) => {
  const { open, board, isLoading, dialogError, onCancel, onSave } = props;
  const initialValues: IBoardFormValues = board
    ? { name: board.name, description: board.description, color: board.color, tags: board.tags }
    : CreateBoardFormInitialValues;

  return (
    <EditDialog<IBoardFormValues>
      open={open}
      dialogTitle={board ? 'Edit Board' : 'Create Board'}
      dialogSaveButtonLabel={board ? 'Save' : 'Create'}
      isLoading={isLoading}
      dialogError={dialogError}
      maxWidth="sm"
      component={{
        element: <BoardForm />,
        initialValues,
        validationSchema: BoardYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
