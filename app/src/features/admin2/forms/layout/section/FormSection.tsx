import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageSection } from 'components/section/PageSection';
import { IFormLayoutSection } from '../formLayout';
import { FormSectionField } from './FormSectionField';

interface IFormSectionProps {
  /** Section to render. */
  section: IFormLayoutSection;
  /** Whether the section is selected for configuration. */
  isSelected: boolean;
  /** Field of this section selected for configuration, if any. */
  selectedFeaturePropertyId: number | null;
  /** Whether this section is showing as the drop target of a dragged section. */
  isDropTarget: boolean;
  /** Whether a section other than this one is being dragged. */
  canDrop: boolean;
  /** Selects the section, or one of its fields, for configuration. */
  onSelect: (featurePropertyId: number | null) => void;
  /** Removes the section from the form. */
  onRemove: () => void;
  /** Removes a field from the section. */
  onRemoveField: (featurePropertyId: number) => void;
  /** Starts dragging this section. */
  onDragStart: () => void;
  /** Marks this section as the drop target. */
  onDragEnter: () => void;
  /** Clears the drop target. */
  onDragLeave: () => void;
  /** Drops the dragged section at this section's position. */
  onDrop: () => void;
  /** Disables dragging and removal for a published form. */
  readOnly: boolean;
}

/**
 * One section of the form builder: a feature type and its fields. Clicking it selects it for configuration, and its
 * handle drags it to another section's position. The drag affordances match `ExpressionBuilderGroup`.
 *
 * @param {IFormSectionProps} props
 * @returns {JSX.Element} Draggable, selectable section.
 */
export const FormSection = ({
  section,
  isSelected,
  selectedFeaturePropertyId,
  isDropTarget,
  canDrop,
  onSelect,
  onRemove,
  onRemoveField,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDrop,
  readOnly
}: IFormSectionProps) => {
  return (
    <Box
      data-testid="form-section"
      data-drop-active={isDropTarget ? 'true' : 'false'}
      onClick={() => onSelect(null)}
      onDragOver={(event) => {
        if (!canDrop) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onDragEnter();
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }

        event.stopPropagation();
        onDragLeave();
      }}
      onDrop={(event) => {
        if (!canDrop) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onDrop();
      }}
      sx={{
        cursor: 'pointer',
        position: 'relative',
        '&::after': {
          border: '2px solid transparent',
          borderRadius: 1,
          content: '""',
          inset: 0,
          pointerEvents: 'none',
          position: 'absolute'
        },
        '&[data-drop-active="true"]::after': {
          borderColor: 'primary.main'
        },
        transition: 'none'
      }}>
      <PageSection
        id={`form-section-${section.featureTypeId}`}
        label={
          <Stack direction="row" alignItems="center" gap={1} component="span">
            {!readOnly && (
              <Box
                component="span"
                draggable
                aria-label="Drag section"
                onDragStart={(event) => {
                  event.stopPropagation();
                  onDragStart();
                }}
                sx={{
                  alignItems: 'center',
                  color: 'text.secondary',
                  cursor: 'grab',
                  display: 'inline-flex',
                  '&:active': {
                    cursor: 'grabbing'
                  }
                }}>
                <DragIndicatorIcon fontSize="small" />
              </Box>
            )}
            {section.label}
          </Stack>
        }
        headerContent={
          !readOnly && (
            <IconButton
              aria-label="Remove section"
              size="small"
              color="inherit"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}>
              <Icon path={mdiTrashCanOutline} size={0.6} />
            </IconButton>
          )
        }
        sx={{ outline: isSelected ? 2 : 0, outlineColor: 'primary.main' }}>
        <Stack gap={1} p={2}>
          {section.fields.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No fields
            </Typography>
          )}
          {section.fields.map((field) => (
            <FormSectionField
              key={field.featurePropertyId}
              field={field}
              isSelected={isSelected && selectedFeaturePropertyId === field.featurePropertyId}
              onSelect={() => onSelect(field.featurePropertyId)}
              onRemove={() => onRemoveField(field.featurePropertyId)}
              readOnly={readOnly}
            />
          ))}
        </Stack>
      </PageSection>
    </Box>
  );
};
