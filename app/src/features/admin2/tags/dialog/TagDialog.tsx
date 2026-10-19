import { EditDialog } from 'components/dialog/EditDialog';
import { TAG_DEFAULT_COLOR } from 'constants/tag';
import { ITag } from 'interfaces/useTagsApi.interface';
import { ITagFormValues, TagForm } from '../form/TagForm';
import { TagYupSchema } from '../form/TagYupSchema';

interface ITagDialogProps {
  open: boolean;
  /** The tag being edited; omitted to create a tag. */
  tag?: ITag;
  isLoading: boolean;
  /** Error from the last save, such as a duplicate name, shown in the dialog. */
  dialogError?: string;
  onCancel: () => void;
  onSave: (values: ITagFormValues) => void;
}

const CreateTagFormInitialValues: ITagFormValues = {
  name: '',
  description: null,
  color: TAG_DEFAULT_COLOR
};

/**
 * Dialog for creating a tag or editing one, using the shared `EditDialog`.
 *
 * @param {ITagDialogProps} props The tag being edited, if any, and the save and cancel handlers.
 * @returns {JSX.Element} The tag dialog.
 */
export const TagDialog = (props: ITagDialogProps) => {
  const { open, tag, isLoading, dialogError, onCancel, onSave } = props;
  const initialValues: ITagFormValues = tag
    ? { name: tag.name, description: tag.description, color: tag.color }
    : CreateTagFormInitialValues;

  return (
    <EditDialog<ITagFormValues>
      open={open}
      dialogTitle={tag ? 'Edit Tag' : 'Create Tag'}
      dialogSaveButtonLabel={tag ? 'Save' : 'Create'}
      isLoading={isLoading}
      dialogError={dialogError}
      maxWidth="sm"
      component={{
        element: <TagForm />,
        initialValues,
        validationSchema: TagYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
