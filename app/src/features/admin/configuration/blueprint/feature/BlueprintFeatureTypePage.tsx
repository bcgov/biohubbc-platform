import Breadcrumbs from '@mui/material/Breadcrumbs';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { isAxiosError } from 'axios';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import dayjs from 'dayjs';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IBlueprint } from 'interfaces/useBlueprintsApi.interface';
import { IBlueprintFeatureType } from 'interfaces/useBlueprintFeatureTypesApi.interface';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { BlueprintSkeleton } from '../skeleton/BlueprintSkeleton';
import { BlueprintPropertiesSection } from '../section/BlueprintPropertiesSection';

/**
 * Show properties belonging to one explicit blueprint feature-type assignment.
 *
 * @returns Assignment header, breadcrumbs, and scoped Properties tab.
 */
export const BlueprintFeatureTypePage = () => {
  const params = useParams();
  const blueprintId = Number(params.blueprintId);
  const blueprintFeatureTypeId = Number(params.blueprintFeatureTypeId);
  const api = useApi();
  const { setSnackbar } = useDialogContext();
  const [metadata, setMetadata] = useState<{ blueprint: IBlueprint; assignment: IBlueprintFeatureType }>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setMetadata(undefined);
    setIsLoading(true);
    /**
     * Fetch scoped metadata and ignore responses after navigation.
     */
    const loadMetadata = async () => {
      if (
        !Number.isInteger(blueprintId) ||
        blueprintId < 1 ||
        !Number.isInteger(blueprintFeatureTypeId) ||
        blueprintFeatureTypeId < 1
      ) {
        setSnackbar({ open: true, snackbarMessage: 'Blueprint feature type not found' });
        setIsLoading(false);
        return;
      }
      try {
        const [blueprint, assignment] = await Promise.all([
          api.blueprints.getBlueprint(blueprintId),
          api.blueprintFeatureTypes.getBlueprintFeatureType(blueprintId, blueprintFeatureTypeId)
        ]);
        if (active) {
          setMetadata({ blueprint, assignment });
        }
      } catch (error) {
        if (active) {
          setSnackbar({
            open: true,
            snackbarMessage:
              isAxiosError(error) && error.response?.status === 404
                ? 'Blueprint feature type not found'
                : (error as Error).message
          });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    loadMetadata();
    return () => {
      active = false;
    };
  }, [api.blueprints, api.blueprintFeatureTypes, blueprintId, blueprintFeatureTypeId, setSnackbar]);

  const blueprint = metadata?.blueprint;
  const assignment = metadata?.assignment;
  const readOnly = Boolean(
    assignment?.record_end_date ||
    blueprint?.record_end_date ||
    (blueprint?.record_effective_date && blueprint.record_effective_date <= dayjs().format('YYYY-MM-DD'))
  );
  return (
    <LoadingGuard
      isLoading={
        isLoading ||
        Boolean(
          metadata &&
          (blueprint?.blueprint_id !== blueprintId || assignment?.blueprint_feature_type_id !== blueprintFeatureTypeId)
        )
      }
      isLoadingFallback={<BlueprintSkeleton tabCount={1} />}>
      <PageHeader
        label={assignment?.display_name ?? 'Feature Type'}
        description={assignment?.description ?? undefined}
        breadcrumbs={
          <Breadcrumbs aria-label="Blueprint feature type breadcrumb">
            <Link component={RouterLink} to="/admin/configuration" color="inherit" underline="hover">
              Configuration
            </Link>
            <Link component={RouterLink} to="/admin/configuration?tab=blueprints" color="inherit" underline="hover">
              Blueprints
            </Link>
            <Link
              component={RouterLink}
              to={`/admin/configuration/blueprints/${blueprintId}`}
              color="inherit"
              underline="hover">
              {blueprint?.name ?? 'Blueprint'}
            </Link>
            <Typography color="text.primary">{assignment?.display_name ?? 'Feature Type'}</Typography>
          </Breadcrumbs>
        }
        tabs={
          <Tabs value="properties" aria-label="Feature type configuration">
            <Tab
              value="properties"
              label="Properties"
              id="feature-properties-tab"
              aria-controls="feature-properties-panel"
            />
          </Tabs>
        }
      />
      <Container
        maxWidth="xl"
        sx={{ py: 4 }}
        role="tabpanel"
        id="feature-properties-panel"
        aria-labelledby="feature-properties-tab">
        {blueprint && assignment && (
          <BlueprintPropertiesSection
            key={`${blueprintId}-${blueprintFeatureTypeId}`}
            blueprintId={blueprintId}
            blueprintFeatureTypeId={blueprintFeatureTypeId}
            readOnly={readOnly}
          />
        )}
      </Container>
    </LoadingGuard>
  );
};
