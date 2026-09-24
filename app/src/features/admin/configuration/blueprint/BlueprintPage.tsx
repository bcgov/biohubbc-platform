import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { isAxiosError } from 'axios';
import { EditDialog } from 'components/dialog/EditDialog';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import dayjs from 'dayjs';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IBlueprint } from 'interfaces/useBlueprintsApi.interface';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { blueprintFormSchema } from '../dialog/ConfigurationFormYupSchema';
import { BlueprintFeatureTypesSection } from './section/BlueprintFeatureTypesSection';
import { BlueprintMetadataForm, IBlueprintMetadataFormValues } from './dialog/BlueprintMetadataForm';
import { BlueprintMetadata } from './section/BlueprintMetadata';
import { BlueprintSkeleton } from './skeleton/BlueprintSkeleton';

/**
 * Show blueprint metadata and independently paginated composition sections.
 *
 * @returns Blueprint detail with breadcrumbs and scoped composition management.
 */
export const BlueprintPage = () => {
  const api = useApi();
  const dialogs = useDialogContext();
  const { setSnackbar } = dialogs;
  const publishing = useRef(false);
  const savingMetadata = useRef(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const { blueprintId } = useParams();
  const id = Number(blueprintId);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab = requestedTab === 'metadata' ? requestedTab : 'feature-types';
  const [blueprint, setBlueprint] = useState<IBlueprint>();
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setBlueprint(undefined);
    setIsEditDialogOpen(false);
    setIsLoading(true);
    /**
     * Fetch metadata independently from membership tables.
     */
    const load = async () => {
      if (!Number.isInteger(id) || id < 1) {
        setSnackbar({ open: true, snackbarMessage: 'Blueprint not found' });
        setIsLoading(false);
        return;
      }
      try {
        const row = await api.blueprints.getBlueprint(id);
        if (active) {
          setBlueprint(row);
        }
      } catch (error) {
        if (active) {
          setSnackbar({
            open: true,
            snackbarMessage:
              isAxiosError(error) && error.response?.status === 404 ? 'Blueprint not found' : (error as Error).message
          });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [api.blueprints, id, setSnackbar]);

  /**
   * Show publication details for a published blueprint or confirm publishing a draft.
   *
   * @returns Opens a confirmation dialog or explains a lifecycle restriction.
   */
  const handlePublishBlueprint = () => {
    if (!blueprint) {
      return;
    }
    if (isPublished) {
      dialogs.setOkDialog({
        open: true,
        dialogTitle: 'Published blueprint',
        dialogText: `This blueprint was published on ${blueprint.record_effective_date}. To make changes, create a new blueprint.`,
        onClose: () => dialogs.setOkDialog({ open: false })
      });
      return;
    }
    if (publishing.current || savingMetadata.current) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Please wait for publication to finish' });
      return;
    }
    if (blueprint.record_end_date || blueprint.record_effective_date) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Only draft blueprints can be published' });
      return;
    }
    const blueprintToPublish = blueprint.blueprint_id;
    dialogs.setYesNoDialog({
      open: true,
      dialogTitle: 'Publish blueprint?',
      dialogContent:
        "Are you sure you want to publish the blueprint? You won't be able to make changes after publishing.",
      yesButtonLabel: 'Publish',
      noButtonLabel: 'Cancel',
      onClose: () => dialogs.setYesNoDialog({ open: false }),
      onNo: () => dialogs.setYesNoDialog({ open: false }),
      onYes: async () => {
        if (publishing.current || savingMetadata.current) {
          return;
        }
        publishing.current = true;
        dialogs.setYesNoDialog({ open: false });
        try {
          const publishedBlueprint = await api.blueprints.publishBlueprint(blueprintToPublish);
          setBlueprint((current) => (current?.blueprint_id === blueprintToPublish ? publishedBlueprint : current));
          dialogs.setSnackbar({ open: true, snackbarMessage: 'Blueprint published' });
        } catch (error) {
          dialogs.setSnackbar({ open: true, snackbarMessage: (error as Error).message });
        } finally {
          publishing.current = false;
        }
      }
    });
  };

  /**
   * Open metadata editing after checking the blueprint lifecycle.
   *
   * @returns Opens the dialog or explains the restriction through a snackbar.
   */
  const handleOpenEditDialog = () => {
    if (publishing.current || savingMetadata.current) {
      setSnackbar({ open: true, snackbarMessage: 'Please wait for the current action to finish' });
      return;
    }
    if (blueprint?.record_end_date) {
      setSnackbar({ open: true, snackbarMessage: 'Cannot edit a retired blueprint' });
      return;
    }
    setEditError('');
    setIsEditDialogOpen(true);
  };

  /**
   * Update only the supplied form metadata and reconcile the confirmed response.
   *
   * @param values Name and description from Formik.
   * @returns Resolves after saving or showing the server error.
   */
  const handleEditBlueprint = async (values: IBlueprintMetadataFormValues) => {
    if (!blueprint || savingMetadata.current || publishing.current) {
      return;
    }
    savingMetadata.current = true;
    setEditError('');
    const editedBlueprintId = blueprint.blueprint_id;
    try {
      const updatedBlueprint = await api.blueprints.updateBlueprint(editedBlueprintId, {
        name: values.name.trim(),
        description: values.description || null
      });
      setBlueprint((current) => (current?.blueprint_id === editedBlueprintId ? updatedBlueprint : current));
      setIsEditDialogOpen(false);
      setSnackbar({ open: true, snackbarMessage: 'Blueprint updated' });
    } catch (error) {
      setEditError((error as Error).message);
      setSnackbar({ open: true, snackbarMessage: (error as Error).message });
    } finally {
      savingMetadata.current = false;
    }
  };

  const isPublished = Boolean(
    blueprint?.record_effective_date && blueprint.record_effective_date <= dayjs().format('YYYY-MM-DD')
  );
  const readOnly = Boolean(blueprint?.record_end_date || isPublished);
  return (
    <LoadingGuard
      isLoading={isLoading || Boolean(blueprint && blueprint.blueprint_id !== id)}
      isLoadingFallback={<BlueprintSkeleton metadata={tab === 'metadata'} />}>
      <PageHeader
        label={blueprint?.name ?? 'Blueprint'}
        buttons={
          blueprint && (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                color={isPublished ? 'success' : 'primary'}
                variant="contained"
                onClick={handlePublishBlueprint}
                data-testid="publish-blueprint-button">
                {isPublished ? 'Published' : 'Publish'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleOpenEditDialog}
                data-testid="edit-blueprint-button">
                Edit
              </Button>
            </Stack>
          )
        }
        breadcrumbs={
          <Breadcrumbs aria-label="Blueprint breadcrumb">
            <Link component={RouterLink} to="/admin/configuration" color="inherit" underline="hover">
              Configuration
            </Link>
            <Link component={RouterLink} to="/admin/configuration?tab=blueprints" color="inherit" underline="hover">
              Blueprints
            </Link>
            <Typography color="text.primary">{blueprint?.name ?? 'Blueprint'}</Typography>
          </Breadcrumbs>
        }
        description={blueprint?.description ?? undefined}
        tabs={
          <Tabs
            value={tab}
            aria-label="Blueprint configuration"
            onChange={(_event, value: string) => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', value);
              setSearchParams(next);
            }}>
            <Tab
              value="feature-types"
              label="Feature Types"
              id="blueprint-feature-types-tab"
              aria-controls="blueprint-panel"
            />
            <Tab value="metadata" label="Metadata" id="blueprint-metadata-tab" aria-controls="blueprint-panel" />
          </Tabs>
        }
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack gap={3}>
          {blueprint && (
            <Box role="tabpanel" id="blueprint-panel" aria-labelledby={`blueprint-${tab}-tab`}>
              {tab === 'metadata' && <BlueprintMetadata blueprint={blueprint} />}
              <BlueprintFeatureTypesSection key={id} blueprintId={id} readOnly={readOnly} tab={tab} />
            </Box>
          )}
        </Stack>
      </Container>
      {blueprint && isEditDialogOpen && (
        <EditDialog<IBlueprintMetadataFormValues>
          open={isEditDialogOpen}
          dialogTitle="Edit Blueprint"
          dialogSaveButtonLabel="Save"
          dialogError={editError}
          onCancel={() => setIsEditDialogOpen(false)}
          onSave={handleEditBlueprint}
          component={{
            element: <BlueprintMetadataForm />,
            initialValues: { name: blueprint.name, description: blueprint.description ?? '' },
            validationSchema: blueprintFormSchema.pick(['name', 'description'])
          }}
        />
      )}
    </LoadingGuard>
  );
};
