import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IFeatureProperty } from 'interfaces/useFeaturePropertiesApi.interface';
import { IFeatureType } from 'interfaces/useFeatureTypesApi.interface';
import { IFormVersionLayout } from 'interfaces/useFormsApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';
import { FormSectionsCanvas } from './canvas/FormSectionsCanvas';
import { FormAdministratorsDialog } from './dialog/FormAdministratorsDialog';
import { FormDetailsForm, IFormDetailsFormValues } from './dialog/FormDetailsForm';
import { formDetailsSchema } from './dialog/FormDetailsYupSchema';
import { FormTeamsDialog } from './dialog/FormTeamsDialog';
import {
  IFormLayout,
  IFormLayoutField,
  IFormLayoutSection,
  IFormLayoutSelection,
  toCreateForm,
  toFormLayout,
  toSaveFormVersion
} from './formLayout';
import { FormConfigPanel } from './panel/FormConfigPanel';
import { FormFeatureTypesPanel } from './panel/FormFeatureTypesPanel';

type FormLayoutAction = 'save' | 'publish';

const CONTRIBUTOR_OPTIONS_PAGINATION = { page: 1, limit: 100, sort: 'client_id', order: 'asc' as const };

interface IAdminFormLayoutEditorProps {
  /** Layout the editor starts from: empty when creating, the saved version otherwise. */
  initialLayout: IFormLayout;
}

/**
 * Form builder: feature types on the left, the form's sections in the middle, and the selected section's
 * configuration on the right. Every form belongs to a contributor, chosen with its slug before the first save, whose
 * codesets its code fields draw from; its administrators review its submissions. The editor owns a working copy of the layout. "Save draft" saves it as-is, creating the
 * form, its first version and its blueprint on first save; "Publish" saves and then publishes the version, replacing
 * the previously published one. A form without a name or slug asks for them first. A published version is shown
 * read-only and can be revised into a new draft; the form's slug, and so its URL, never changes.
 *
 * @param {IAdminFormLayoutEditorProps} props
 * @returns {JSX.Element} Form builder page.
 */
export const AdminFormLayoutEditor = ({ initialLayout }: IAdminFormLayoutEditorProps) => {
  const biohubApi = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();

  const [layout, setLayout] = useState<IFormLayout>(initialLayout);
  const [selection, setSelection] = useState<IFormLayoutSelection | null>(null);
  const [pendingAction, setPendingAction] = useState<FormLayoutAction | null>(null);
  const [isTeamsDialogOpen, setIsTeamsDialogOpen] = useState(false);
  const [isAdministratorsDialogOpen, setIsAdministratorsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const readOnly = layout.isPublished;
  const hasDetails = Boolean(layout.name.trim() && layout.slug.trim() && layout.contributorId !== null);

  const contributorsQuery = useQuery({
    queryKey: ['forms', 'contributorOptions'],
    queryFn: () => biohubApi.contributors.listContributors({ active_only: true }, CONTRIBUTOR_OPTIONS_PAGINATION),
    enabled: pendingAction !== null
  });
  const contributorOptions = (contributorsQuery.data?.contributors ?? []).map((contributor) => ({
    value: contributor.contributor_id,
    label: contributor.client_id
  }));
  const selectedSection = layout.sections.find((section) => section.featureTypeId === selection?.featureTypeId);
  const selectedField =
    selectedSection?.fields.find((field) => field.featurePropertyId === selection?.featurePropertyId) ?? null;

  /**
   * Apply a change to one section.
   *
   * @param {number} featureTypeId Section to change.
   * @param {Partial<IFormLayoutSection>} changes Changed section properties.
   */
  const updateSection = (featureTypeId: number, changes: Partial<IFormLayoutSection>) => {
    setLayout((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.featureTypeId === featureTypeId ? { ...section, ...changes } : section
      )
    }));
  };

  /**
   * Apply a change to one field of a section.
   *
   * @param {number} featureTypeId Section owning the field.
   * @param {number} featurePropertyId Field to change.
   * @param {Partial<IFormLayoutField>} changes Changed field properties.
   */
  const updateField = (featureTypeId: number, featurePropertyId: number, changes: Partial<IFormLayoutField>) => {
    setLayout((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.featureTypeId !== featureTypeId) {
          return section;
        }

        return {
          ...section,
          fields: section.fields.map((field) =>
            field.featurePropertyId === featurePropertyId ? { ...field, ...changes } : field
          )
        };
      })
    }));
  };

  /**
   * Append feature types as sections at the end of the form, skipping any already present.
   *
   * @param {IFeatureType[]} featureTypes Selected feature types.
   */
  const handleAddFeatureTypes = (featureTypes: IFeatureType[]) => {
    setLayout((current) => {
      const newSections: IFormLayoutSection[] = featureTypes
        .filter(
          (featureType) => !current.sections.some((section) => section.featureTypeId === featureType.feature_type_id)
        )
        .map((featureType) => ({
          featureTypeId: featureType.feature_type_id,
          displayName: featureType.display_name,
          label: featureType.display_name,
          description: null,
          requiredValue: false,
          allowMultiple: false,
          fields: []
        }));

      return { ...current, sections: [...current.sections, ...newSections] };
    });
  };

  /**
   * Append properties as fields at the end of the selected section, skipping any already present.
   *
   * @param {IFeatureProperty[]} featureProperties Selected properties.
   */
  const handleAddFields = (featureProperties: IFeatureProperty[]) => {
    if (!selectedSection) {
      return;
    }

    const newFields: IFormLayoutField[] = featureProperties
      .filter(
        (featureProperty) =>
          !selectedSection.fields.some((field) => field.featurePropertyId === featureProperty.feature_property_id)
      )
      .map((featureProperty) => ({
        featurePropertyId: featureProperty.feature_property_id,
        displayName: featureProperty.display_name,
        typeName: featureProperty.type_name,
        label: featureProperty.display_name,
        description: null,
        contributorCodesetId: null
      }));

    updateSection(selectedSection.featureTypeId, { fields: [...selectedSection.fields, ...newFields] });
  };

  /**
   * Report a failed request through the shared error dialog.
   *
   * @param {unknown} error_ The failure.
   * @param {string} title Dialog title.
   */
  const showError = (error_: unknown, title: string) => {
    const apiError = error_ as APIError;

    dialogContext.setErrorDialog({
      open: true,
      dialogTitle: title,
      dialogText: 'The request could not be completed. Your changes are still on this page.',
      dialogError: apiError.message,
      dialogErrorDetails: apiError.errors,
      onClose: () => dialogContext.setErrorDialog({ open: false }),
      onOk: () => dialogContext.setErrorDialog({ open: false })
    });
  };

  /**
   * Put a saved version in the query cache, refresh the form list, and move to the version's address when it is not
   * the one being edited. The cache entry lets the page show the version without reloading it.
   *
   * @param {IFormVersionLayout} result Saved version.
   */
  const applySavedVersion = async (result: IFormVersionLayout) => {
    queryClient.setQueryData(formQueryKeys.version(result.form.form_id, result.form_version.form_version_id), result);
    await queryClient.invalidateQueries({ queryKey: [...formQueryKeys.all(), 'list'] });
    setLayout(toFormLayout(result));

    if (result.form_version.form_version_id !== layout.formVersionId) {
      navigate(`/admin/forms/${result.form.form_id}/versions/${result.form_version.form_version_id}`, {
        replace: layout.formVersionId === null
      });
    }
  };

  /**
   * Save the layout, and publish it when asked.
   *
   * @param {FormLayoutAction} action Whether to publish after saving.
   * @param {IFormLayout} current Layout to save.
   */
  const submitLayout = async (action: FormLayoutAction, current: IFormLayout) => {
    setIsSubmitting(true);

    try {
      let saved: IFormVersionLayout;

      if (current.formId === null || current.formVersionId === null) {
        saved = await biohubApi.forms.createForm(toCreateForm(current));
      } else {
        saved = await biohubApi.forms.updateFormVersion(
          current.formId,
          current.formVersionId,
          toSaveFormVersion(current)
        );
      }

      let result = saved;

      if (action === 'publish') {
        result = await biohubApi.forms.publishFormVersion(saved.form.form_id, saved.form_version.form_version_id);
      }

      await applySavedVersion(result);
    } catch (error_) {
      showError(error_, action === 'publish' ? 'Error Publishing Form' : 'Error Saving Form');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Create a draft revision of the published form and open it.
   */
  const handleRevise = async () => {
    if (layout.formId === null) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await biohubApi.forms.createFormVersion(layout.formId);
      await applySavedVersion(result);
    } catch (error_) {
      showError(error_, 'Error Revising Form');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Save or publish, first asking for a name, slug and contributor when the form has none.
   *
   * @param {FormLayoutAction} action Whether to publish after saving.
   */
  const handleAction = async (action: FormLayoutAction) => {
    if (!hasDetails) {
      setPendingAction(action);
      return;
    }

    await submitLayout(action, layout);
  };

  const title = layout.name || 'New Form';
  const subtitle = layout.versionNumber ? `/forms/${layout.slug} · Version ${layout.versionNumber}` : undefined;

  return (
    <AdminPageLayout
      title={title}
      subtitle={subtitle}
      description={layout.description}
      breadcrumbs={
        <Breadcrumbs aria-label="form breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Link component={RouterLink} to="/admin/forms" underline="hover" color="inherit">
            Forms
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            {title}
          </Typography>
        </Breadcrumbs>
      }
      buttons={
        <Stack direction="row" gap={1}>
          {layout.formId !== null && (
            <Button variant="outlined" disabled={isSubmitting} onClick={() => setIsTeamsDialogOpen(true)}>
              Access
            </Button>
          )}
          {layout.teamId !== null && (
            <Button variant="outlined" disabled={isSubmitting} onClick={() => setIsAdministratorsDialogOpen(true)}>
              Administrators
            </Button>
          )}
          {readOnly && !layout.isRetired && (
            <Button variant="contained" disabled={isSubmitting} onClick={handleRevise}>
              Revise
            </Button>
          )}
          {!readOnly && (
            <>
              <Button variant="outlined" disabled={isSubmitting} onClick={() => setPendingAction('save')}>
                Details
              </Button>
              <Button variant="outlined" disabled={isSubmitting} onClick={() => handleAction('save')}>
                Save draft
              </Button>
              <Button
                variant="contained"
                disabled={isSubmitting || !layout.sections.length}
                onClick={() => handleAction('publish')}>
                Publish
              </Button>
            </>
          )}
        </Stack>
      }
      tabs={[{ value: 'layout', label: 'Layout', id: 'form-layout', ariaControls: 'form-layout-panel' }]}
      activeTab="layout"
      onTabChange={() => undefined}>
      <Grid container spacing={3} id="form-layout-panel" role="tabpanel" aria-labelledby="form-layout">
        <Grid size={{ xs: 12, md: 3 }}>
          <FormFeatureTypesPanel
            addedFeatureTypeIds={layout.sections.map((section) => section.featureTypeId)}
            onAdd={handleAddFeatureTypes}
            readOnly={readOnly}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormSectionsCanvas
            sections={layout.sections}
            selection={selection}
            onSelect={setSelection}
            onSectionsChange={(sections) => setLayout((current) => ({ ...current, sections }))}
            readOnly={readOnly}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          {selectedSection && (
            <FormConfigPanel
              key={selectedSection.featureTypeId}
              contributorId={layout.contributorId}
              section={selectedSection}
              field={selectedField}
              onClose={() => setSelection(null)}
              onAddFields={handleAddFields}
              onSectionChange={(changes) => updateSection(selectedSection.featureTypeId, changes)}
              onFieldChange={(changes) => {
                if (selectedField) {
                  updateField(selectedSection.featureTypeId, selectedField.featurePropertyId, changes);
                }
              }}
              readOnly={readOnly}
            />
          )}
        </Grid>
      </Grid>
      {pendingAction && (
        <EditDialog<IFormDetailsFormValues>
          open
          dialogTitle="Form Details"
          dialogSaveButtonLabel={hasDetails ? 'Save' : 'Continue'}
          onCancel={() => setPendingAction(null)}
          onSave={async (values) => {
            const detailed: IFormLayout = {
              ...layout,
              slug: values.slug.trim(),
              contributorId: values.contributorId,
              name: values.name.trim(),
              description: values.description || null,
              isPublic: values.isPublic
            };

            setLayout(detailed);
            setPendingAction(null);

            // A dialog opened because the form had no details continues with the save or publish that opened it.
            if (!hasDetails) {
              await submitLayout(pendingAction, detailed);
            }
          }}
          component={{
            element: <FormDetailsForm isSlugLocked={layout.formId !== null} contributorOptions={contributorOptions} />,
            initialValues: {
              slug: layout.slug,
              contributorId: layout.contributorId,
              name: layout.name,
              description: layout.description ?? '',
              isPublic: layout.isPublic
            },
            validationSchema: formDetailsSchema
          }}
        />
      )}
      {isTeamsDialogOpen && layout.formId !== null && (
        <FormTeamsDialog formId={layout.formId} onClose={() => setIsTeamsDialogOpen(false)} />
      )}
      {isAdministratorsDialogOpen && layout.teamId !== null && (
        <FormAdministratorsDialog teamId={layout.teamId} onClose={() => setIsAdministratorsDialogOpen(false)} />
      )}
    </AdminPageLayout>
  );
};
