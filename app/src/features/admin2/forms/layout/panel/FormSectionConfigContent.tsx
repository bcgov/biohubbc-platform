import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { IFormLayoutSection } from '../formLayout';

interface IFormSectionConfigContentProps {
  /** Section being configured. */
  section: IFormLayoutSection;
  /** Applies a change to the section's presentation. */
  onChange: (changes: Partial<IFormLayoutSection>) => void;
  /** Disables every input for a published form. */
  readOnly: boolean;
}

/**
 * Config tab of the form builder's configuration panel for a section: its display label and description, whether it
 * requires at least one row, and whether it accepts more than one row.
 *
 * @param {IFormSectionConfigContentProps} props
 * @returns {JSX.Element} Section configuration inputs.
 */
export const FormSectionConfigContent = ({ section, onChange, readOnly }: IFormSectionConfigContentProps) => {
  return (
    <Stack gap={2} p={2}>
      <TextField
        label="Label"
        size="small"
        fullWidth
        required
        disabled={readOnly}
        value={section.label}
        onChange={(event) => onChange({ label: event.target.value })}
      />
      <TextField
        label="Description"
        size="small"
        fullWidth
        multiline
        rows={3}
        disabled={readOnly}
        value={section.description ?? ''}
        onChange={(event) => onChange({ description: event.target.value || null })}
      />
      <FormControlLabel
        label="Required"
        disabled={readOnly}
        control={
          <Switch
            checked={section.requiredValue}
            onChange={(event) => onChange({ requiredValue: event.target.checked })}
          />
        }
      />
      <FormControlLabel
        label="Allow multiple"
        disabled={readOnly}
        control={
          <Switch
            checked={section.allowMultiple}
            onChange={(event) => onChange({ allowMultiple: event.target.checked })}
          />
        }
      />
    </Stack>
  );
};
