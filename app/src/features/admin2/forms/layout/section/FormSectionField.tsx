import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IFormLayoutField } from '../formLayout';

interface IFormSectionFieldProps {
  /** Field to render. */
  field: IFormLayoutField;
  /** Whether the field is selected for configuration. */
  isSelected: boolean;
  /** Selects the field for configuration. */
  onSelect: () => void;
  /** Removes the field from its section. */
  onRemove: () => void;
  /** Hides the remove action for a published form. */
  readOnly: boolean;
}

/**
 * One field of a form builder section. Clicking it selects it for configuration.
 *
 * @param {IFormSectionFieldProps} props
 * @returns {JSX.Element} Selectable field row.
 */
export const FormSectionField = ({ field, isSelected, onSelect, onRemove, readOnly }: IFormSectionFieldProps) => {
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{ borderRadius: 1, bgcolor: isSelected ? 'action.selected' : 'action.hover' }}>
      <ButtonBase
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        sx={{ flex: 1, justifyContent: 'flex-start', textAlign: 'left', px: 1.5, py: 1 }}>
        <Stack>
          <Typography variant="body2" fontWeight={700}>
            {field.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {field.typeName}
          </Typography>
        </Stack>
      </ButtonBase>
      {!readOnly && (
        <IconButton
          aria-label="Remove field"
          size="small"
          color="inherit"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          sx={{ mr: 1 }}>
          <Icon path={mdiTrashCanOutline} size={0.6} />
        </IconButton>
      )}
    </Stack>
  );
};
