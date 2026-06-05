import { mdiCheck, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useCartContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SubmissionFeatureDetailContent } from './components/SubmissionFeatureDetailContent';

export const SubmissionFeaturePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const biohubApi = useApi();
  const { cartId, addToCart, removeFromCart } = useCartContext();
  const [isInCart, setIsInCart] = useState(false);

  const { submissionId, submissionFeatureId } = useParams<{ submissionId: string; submissionFeatureId: string }>();

  const featureDataLoader = useDataLoader(
    (submissionId, submissionFeatureId) =>
      biohubApi.features.getSubmissionFeatureById(submissionId, submissionFeatureId),
    (error: unknown) => {
      const status = (error as APIError)?.status;
      if (status === 401 || status === 403) {
        navigate('/forbidden', { replace: true });
      }
    }
  );
  useEffect(() => {
    featureDataLoader.refresh(submissionId, submissionFeatureId);
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

    biohubApi.cart.getCartFeatures(cartId, { submissionFeatureId: Number(submissionFeatureId) }).then((response) => {
      if (isCurrent) {
        setIsInCart(response.features.length > 0);
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
          relevancy_score: 0,
          create_date: ''
        }
      ]);
    }
  };

  return (
    <SubmissionFeatureDetailContent
      isLoading={isLoading}
      feature={feature}
      relatedFeatures={relatedFeatures ?? []}
      submissionId={submissionId}
      rootBreadcrumbLabel="Search"
      rootBreadcrumbTo={`/search/${location.search}`}
      submissionDetailBasePath="/submission"
      featureRouteBasePath="/submission"
      queryString={location.search}
      buttons={
        <Button
          variant={isInCart ? 'outlined' : 'contained'}
          startIcon={<Icon path={isInCart ? mdiCheck : mdiPlus} size={0.875} />}
          onClick={handleCartToggle}>
          {isInCart ? 'In Cart' : 'Add to Cart'}
        </Button>
      }
    />
  );
};
