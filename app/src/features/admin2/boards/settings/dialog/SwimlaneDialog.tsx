import { EditDialog } from 'components/dialog/EditDialog';
import { IBoardSwimlane, IBoardTag } from 'interfaces/useBoardsApi.interface';
import { ISwimlaneFormValues, SwimlaneForm } from '../form/SwimlaneForm';
import { SwimlaneYupSchema } from '../form/SwimlaneYupSchema';

interface ISwimlaneDialogProps {
  open: boolean;
  /** The swimlane being edited; omitted to add a swimlane. */
  swimlane?: IBoardSwimlane;
  /** The board's tags, the only tags a lane can hold. */
  boardTags: IBoardTag[];
  isLoading: boolean;
  /** Error from the last save, shown in the dialog. */
  dialogError?: string;
  onCancel: () => void;
  onSave: (values: ISwimlaneFormValues) => void;
}

const CreateSwimlaneFormInitialValues: ISwimlaneFormValues = {
  name: '',
  description: null,
  color: null,
  isVisible: true,
  tags: []
};

/**
 * Dialog for adding a swimlane to a board or editing one, using the shared `EditDialog`.
 *
 * @param {ISwimlaneDialogProps} props The swimlane being edited, if any, the board's tags, and the save and cancel
 * handlers.
 * @returns {JSX.Element} The swimlane dialog.
 */
export const SwimlaneDialog = (props: ISwimlaneDialogProps) => {
  const { open, swimlane, boardTags, isLoading, dialogError, onCancel, onSave } = props;
  const initialValues: ISwimlaneFormValues = swimlane
    ? {
        name: swimlane.name,
        description: swimlane.description,
        color: swimlane.color,
        isVisible: swimlane.is_visible,
        tags: swimlane.tags
      }
    : CreateSwimlaneFormInitialValues;

  return (
    <EditDialog<ISwimlaneFormValues>
      open={open}
      dialogTitle={swimlane ? 'Edit Swimlane' : 'Add Swimlane'}
      dialogSaveButtonLabel={swimlane ? 'Save' : 'Add'}
      isLoading={isLoading}
      dialogError={dialogError}
      maxWidth="sm"
      component={{
        element: <SwimlaneForm boardTags={boardTags} />,
        initialValues,
        validationSchema: SwimlaneYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
