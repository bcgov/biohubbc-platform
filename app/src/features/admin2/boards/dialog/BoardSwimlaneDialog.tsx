import { EditDialog } from 'components/dialog/EditDialog';
import { getTagColorDigits } from 'features/admin2/tags/form/tag-color';
import { IBoardSwimlane } from 'interfaces/useBoardsApi.interface';
import { BoardSwimlaneForm, IBoardSwimlaneFormValues } from '../form/BoardSwimlaneForm';
import { BoardSwimlaneYupSchema } from '../form/BoardSwimlaneYupSchema';

interface IBoardSwimlaneDialogProps {
  open: boolean;
  /** The swimlane being edited; omitted to create a swimlane. */
  swimlane?: IBoardSwimlane;
  isLoading: boolean;
  /** Error from the last save, such as a duplicate name, shown in the dialog. */
  dialogError?: string;
  onCancel: () => void;
  onSave: (values: IBoardSwimlaneFormValues) => void;
}

const CreateBoardSwimlaneFormInitialValues: IBoardSwimlaneFormValues = {
  name: '',
  description: null,
  color: '',
  sortOrder: ''
};

/**
 * Dialog for creating a board swimlane or editing one, using the shared `EditDialog`.
 *
 * @param {IBoardSwimlaneDialogProps} props The swimlane being edited, if any, and the save and cancel handlers.
 * @returns {JSX.Element} The swimlane dialog.
 */
export const BoardSwimlaneDialog = (props: IBoardSwimlaneDialogProps) => {
  const { open, swimlane, isLoading, dialogError, onCancel, onSave } = props;
  const initialValues: IBoardSwimlaneFormValues = swimlane
    ? {
        name: swimlane.name,
        description: swimlane.description,
        color: swimlane.color ? getTagColorDigits(swimlane.color) : '',
        sortOrder: String(swimlane.sort_order)
      }
    : CreateBoardSwimlaneFormInitialValues;

  return (
    <EditDialog<IBoardSwimlaneFormValues>
      open={open}
      dialogTitle={swimlane ? 'Edit Swimlane' : 'Create Swimlane'}
      dialogSaveButtonLabel={swimlane ? 'Save' : 'Create'}
      isLoading={isLoading}
      dialogError={dialogError}
      maxWidth="sm"
      component={{
        element: <BoardSwimlaneForm />,
        initialValues,
        validationSchema: BoardSwimlaneYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
