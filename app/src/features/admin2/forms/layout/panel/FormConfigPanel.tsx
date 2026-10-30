import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import IconButton from '@mui/material/IconButton';
import { PageSection } from 'components/section/PageSection';
import { TabGroup } from 'components/tabs/TabGroup';
import { IFeatureProperty } from 'interfaces/useFeaturePropertiesApi.interface';
import { useState } from 'react';
import { IFormLayoutField, IFormLayoutSection } from '../formLayout';
import { FormFieldConfigContent } from './FormFieldConfigContent';
import { FormSectionConfigContent } from './FormSectionConfigContent';
import { FormSectionFieldsContent } from './FormSectionFieldsContent';

type FormConfigTab = 'fields' | 'config';

interface IFormConfigPanelProps {
  /** Contributor that owns the form, whose codesets code fields draw from. Null until chosen. */
  contributorId: number | null;
  /** Selected section. */
  section: IFormLayoutSection;
  /** Selected field within the section, if any. */
  field: IFormLayoutField | null;
  /** Clears the selection, closing the panel. */
  onClose: () => void;
  /** Appends properties to the selected section as fields. */
  onAddFields: (featureProperties: IFeatureProperty[]) => void;
  /** Applies a change to the selected section's presentation. */
  onSectionChange: (changes: Partial<IFormLayoutSection>) => void;
  /** Applies a change to the selected field's presentation. */
  onFieldChange: (changes: Partial<IFormLayoutField>) => void;
  /** Disables changes for a published form. */
  readOnly: boolean;
}

/**
 * Right sidebar of the form builder, configuring the selected section. The Fields tab adds properties to the section;
 * the Config tab edits the selected field when one is selected, and the section otherwise.
 *
 * @param {IFormConfigPanelProps} props
 * @returns {JSX.Element} Selected section configuration.
 */
export const FormConfigPanel = ({
  contributorId,
  section,
  field,
  onClose,
  onAddFields,
  onSectionChange,
  onFieldChange,
  readOnly
}: IFormConfigPanelProps) => {
  const [activeTab, setActiveTab] = useState<FormConfigTab>('fields');

  return (
    <PageSection
      id="form-config"
      label={field?.label ?? section.label}
      headerContent={
        <IconButton aria-label="Close configuration" size="small" onClick={onClose}>
          <Icon path={mdiClose} size={0.875} />
        </IconButton>
      }>
      <TabGroup<FormConfigTab>
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="configuration tabs"
        tabs={[
          { value: 'fields', label: 'Fields', id: 'form-config-fields', ariaControls: 'form-config-panel' },
          { value: 'config', label: 'Config', id: 'form-config-config', ariaControls: 'form-config-panel' }
        ]}
      />
      <div id="form-config-panel" role="tabpanel" aria-labelledby={`form-config-${activeTab}`}>
        {activeTab === 'fields' && (
          <FormSectionFieldsContent
            addedFeaturePropertyIds={section.fields.map((sectionField) => sectionField.featurePropertyId)}
            onAdd={onAddFields}
            readOnly={readOnly}
          />
        )}
        {activeTab === 'config' && field && (
          <FormFieldConfigContent
            contributorId={contributorId}
            field={field}
            onChange={onFieldChange}
            readOnly={readOnly}
          />
        )}
        {activeTab === 'config' && !field && (
          <FormSectionConfigContent section={section} onChange={onSectionChange} readOnly={readOnly} />
        )}
      </div>
    </PageSection>
  );
};
