import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { IFormLayoutSection, IFormLayoutSelection, moveSection } from '../formLayout';
import { FormSection } from '../section/FormSection';

interface IFormSectionsCanvasProps {
  /** Sections in display order. */
  sections: IFormLayoutSection[];
  /** Section, and optionally field, selected for configuration. */
  selection: IFormLayoutSelection | null;
  /** Selects a section, or a field within it. */
  onSelect: (selection: IFormLayoutSelection) => void;
  /** Replaces the sections, after a reorder or removal. */
  onSectionsChange: (sections: IFormLayoutSection[]) => void;
  /** Disables dragging and removal for a published form. */
  readOnly: boolean;
}

/**
 * Middle column of the form builder: the form's sections in display order. Owns the drag state used to reorder
 * sections; dropping a section on another moves it to that section's position.
 *
 * @param {IFormSectionsCanvasProps} props
 * @returns {JSX.Element} Ordered form sections.
 */
export const FormSectionsCanvas = ({
  sections,
  selection,
  onSelect,
  onSectionsChange,
  readOnly
}: IFormSectionsCanvasProps) => {
  const [draggedFeatureTypeId, setDraggedFeatureTypeId] = useState<number | null>(null);
  const [activeDropFeatureTypeId, setActiveDropFeatureTypeId] = useState<number | null>(null);

  if (!sections.length) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary" textAlign="center">
          No sections
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack gap={2} onDragEnd={() => setDraggedFeatureTypeId(null)}>
      {sections.map((section) => (
        <FormSection
          key={section.featureTypeId}
          section={section}
          isSelected={selection?.featureTypeId === section.featureTypeId}
          selectedFeaturePropertyId={selection?.featurePropertyId ?? null}
          isDropTarget={activeDropFeatureTypeId === section.featureTypeId}
          canDrop={!readOnly && draggedFeatureTypeId !== null && draggedFeatureTypeId !== section.featureTypeId}
          onSelect={(featurePropertyId) => onSelect({ featureTypeId: section.featureTypeId, featurePropertyId })}
          onRemove={() => onSectionsChange(sections.filter((item) => item.featureTypeId !== section.featureTypeId))}
          onRemoveField={(featurePropertyId) =>
            onSectionsChange(
              sections.map((item) =>
                item.featureTypeId === section.featureTypeId
                  ? { ...item, fields: item.fields.filter((field) => field.featurePropertyId !== featurePropertyId) }
                  : item
              )
            )
          }
          onDragStart={() => {
            setDraggedFeatureTypeId(section.featureTypeId);
            setActiveDropFeatureTypeId(null);
          }}
          onDragEnter={() => setActiveDropFeatureTypeId(section.featureTypeId)}
          onDragLeave={() => setActiveDropFeatureTypeId(null)}
          onDrop={() => {
            if (draggedFeatureTypeId !== null) {
              onSectionsChange(moveSection(sections, draggedFeatureTypeId, section.featureTypeId));
            }
            setDraggedFeatureTypeId(null);
            setActiveDropFeatureTypeId(null);
          }}
          readOnly={readOnly}
        />
      ))}
    </Stack>
  );
};
