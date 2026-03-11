import { mdiCheck, mdiLock, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useCartContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonTable } from 'components/loading/SkeletonLoaders';
import { SubmissionFeatureProperties } from './components/SubmissionFeatureProperties';
import { SubmissionFeatureRelated } from './components/SubmissionFeatureRelated';

export const SubmissionFeaturePage = () => {
  const navigate = useNavigate();
  const biohubApi = useApi();
  const { cartId, addToCart, removeFromCart } = useCartContext();
  const [isInCart, setIsInCart] = useState(false);

  const { submissionId, submissionFeatureId } = useParams<{ submissionId: string; submissionFeatureId: string }>();

  const featureDataLoader = useDataLoader(
    () => biohubApi.features.getSubmissionFeatureById(Number(submissionId), Number(submissionFeatureId)),
    (error: unknown) => {
      const status = (error as APIError)?.status;
      if (status === 401 || status === 403) {
        navigate('/forbidden', { replace: true });
      }
    }
  );
  useEffect(() => {
    featureDataLoader.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, submissionFeatureId]);

  const { feature, relatedFeatures } = useMemo(
    () => featureDataLoader.data ?? { feature: undefined, relatedFeatures: undefined },
    [featureDataLoader.data]
  );
  const isLoading = featureDataLoader.isLoading;

  useEffect(() => {
    if (!cartId || !submissionFeatureId) {
      return;
    }

    let isCurrent = true;

    biohubApi.cart.isFeatureInCart(cartId, Number(submissionFeatureId)).then((response) => {
      if (isCurrent) {
        setIsInCart(response.isInCart);
      }
    });

    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartId, submissionFeatureId]);

  const handleCartToggle = async () => {
    if (!feature) {
      return;
    }

    if (isInCart) {
      setIsInCart(false);
      await removeFromCart([feature.submission_feature_id]);
    } else {
      setIsInCart(true);
      await addToCart([
        {
          submission_feature_id: feature.submission_feature_id,
          submission_id: feature.submission_id,
          uuid: feature.uuid,
          feature_type_id: feature.feature_type_id,
          feature_type_name: feature.feature_type_name,
          feature_name: null,
          feature_description: null,
          submission_name: feature.submission_name,
          is_secured: feature.secured,
          relevancy_score: 0
        }
      ]);
    }
  };

  return (
    <Box>
      <LoadingGuard
        isLoading={isLoading}
        isLoadingFallback={<SkeletonTable numberOfLines={6} />}
        hasNoData={!feature}
        hasNoDataFallback={
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        }>
        <PageHeader
          buttons={
            <Button
              variant={isInCart ? 'outlined' : 'contained'}
              startIcon={<Icon path={isInCart ? mdiCheck : mdiPlus} size={0.875} />}
              onClick={handleCartToggle}>
              {isInCart ? 'In Cart' : 'Add to Cart'}
            </Button>
          }
          breadcrumbs={
            <Breadcrumbs aria-label="breadcrumb">
              <Link component={RouterLink} to="/search" underline="hover" color="inherit">
                Search
              </Link>
              <Link component={RouterLink} to={`/search/${feature?.submission_id}`} underline="hover" color="inherit">
                {feature?.submission_name}
              </Link>
              <Typography color="text.primary">{feature?.feature_type_display_name}</Typography>
            </Breadcrumbs>
          }
          label={
            <Box display="flex" alignItems="center" gap={1.5}>
              <Typography variant="h1" sx={{ ml: '-2px' }}>
                {feature?.feature_type_display_name}
              </Typography>
            </Box>
          }
          subheader={
            <Box display="flex" gap={1}>
              <Chip label={feature?.feature_type_name} size="small" />
              {feature?.secured && <Chip icon={<Icon path={mdiLock} size={0.625} />} label="Secured" size="small" />}
            </Box>
          }
        />
        <Container maxWidth="xl">
          <Stack spacing={3} py={4}>
            <SubmissionFeatureProperties data={feature?.data ?? {}} />
            <SubmissionFeatureRelated submissionId={submissionId} relatedFeatures={relatedFeatures ?? []} />
          </Stack>
        </Container>
      </LoadingGuard>
    </Box>
  );
};
