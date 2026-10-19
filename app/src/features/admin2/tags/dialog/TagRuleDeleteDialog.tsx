import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import YesNoDialog from 'components/dialog/YesNoDialog';
import { ITagRule } from 'interfaces/useTagRulesApi.interface';
import { useState } from 'react';

interface ITagRuleDeleteDialogProps {
  /** The tag rule to delete; the dialog is closed while omitted. */
  tagRule?: ITagRule;
  onCancel: () => void;
  /** Called once confirmed, with whether to also remove the tags the rule applied. */
  onDelete: (tagRule: ITagRule, removeTags: boolean) => void;
}

/**
 * Confirmation for deleting a tag rule, with the choice to also remove the tags the rule applied to tickets. Left
 * unchecked, those tags stay on their tickets.
 *
 * @param {ITagRuleDeleteDialogProps} props The rule to delete and the confirm and cancel handlers.
 * @returns {JSX.Element} The delete confirmation.
 */
export const TagRuleDeleteDialog = (props: ITagRuleDeleteDialogProps) => {
  const { tagRule, onCancel, onDelete } = props;
  const [removeTags, setRemoveTags] = useState(false);

  /**
   * Closes the dialog, clearing the remove-tags choice for the next rule.
   *
   * @returns {void}
   */
  const handleCancel = () => {
    setRemoveTags(false);
    onCancel();
  };

  return (
    <YesNoDialog
      open={Boolean(tagRule)}
      dialogTitle="Delete tag rule?"
      dialogText=""
      dialogContent={
        <>
          <Typography component="div" color="textSecondary">
            Deleting tag rule <strong>{tagRule?.name}</strong> stops it applying its tag. This cannot be undone.
          </Typography>
          <FormControlLabel
            sx={{ mt: 1 }}
            label="Also remove the tags this rule applied"
            control={<Checkbox checked={removeTags} onChange={(event) => setRemoveTags(event.target.checked)} />}
          />
        </>
      }
      yesButtonLabel="Delete Tag Rule"
      noButtonLabel="Cancel"
      yesButtonProps={{ color: 'error' }}
      onClose={handleCancel}
      onNo={handleCancel}
      onYes={() => {
        if (tagRule) {
          onDelete(tagRule, removeTags);
        }
        setRemoveTags(false);
      }}
    />
  );
};
