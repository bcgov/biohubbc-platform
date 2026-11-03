import { EditDialog } from 'components/dialog/EditDialog';
import { ITagRuleDetail } from 'interfaces/useTagRulesApi.interface';
import { ITagRuleFormValues, TagRuleForm } from '../form/TagRuleForm';
import { TagRuleYupSchema } from '../form/TagRuleYupSchema';

interface ITagRuleDialogProps {
  open: boolean;
  /**
   * The rule being edited, with its expression; omitted to create a rule. The expression builder reads its value
   * once, when the dialog opens, so an edited rule must be loaded before the dialog is opened.
   */
  tagRule?: ITagRuleDetail;
  isLoading: boolean;
  /** Error from the last save, such as a duplicate name, shown in the dialog. */
  dialogError?: string;
  onCancel: () => void;
  onSave: (values: ITagRuleFormValues) => void;
}

const CreateTagRuleFormInitialValues: ITagRuleFormValues = {
  name: '',
  description: null,
  expression: null
};

/**
 * Dialog for creating a tag rule or editing one's name, description and expression, using the shared `EditDialog`
 * as the policy expression dialog does. Whether a rule is enabled is not edited here: new rules are created enabled,
 * and a rule is enabled or disabled from its row.
 *
 * @param {ITagRuleDialogProps} props The rule being edited, if any, and the save and cancel handlers.
 * @returns {JSX.Element} The tag rule dialog.
 */
export const TagRuleDialog = (props: ITagRuleDialogProps) => {
  const { open, tagRule, isLoading, dialogError, onCancel, onSave } = props;
  const initialValues: ITagRuleFormValues = tagRule
    ? {
        name: tagRule.name,
        description: tagRule.description,
        expression: tagRule.expression
      }
    : CreateTagRuleFormInitialValues;

  return (
    <EditDialog<ITagRuleFormValues>
      open={open}
      dialogTitle={tagRule ? 'Edit Rule' : 'Create Rule'}
      dialogSaveButtonLabel={tagRule ? 'Save' : 'Create'}
      isLoading={isLoading}
      dialogError={dialogError}
      maxWidth="md"
      component={{
        element: <TagRuleForm />,
        initialValues,
        validationSchema: TagRuleYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
