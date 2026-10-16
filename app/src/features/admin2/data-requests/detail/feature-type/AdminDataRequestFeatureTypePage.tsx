import { Navigate, useParams } from 'react-router-dom';
import { AdminDataRequestFeatureTypePageContent } from './content/AdminDataRequestFeatureTypePageContent';

/**
 * Administrative page of one feature type of a data request: reads the route's data request id and feature type, then
 * shows the requested features of that type. The content is keyed by both so a different feature type starts from
 * fresh state.
 *
 * @returns {JSX.Element} The feature type page, or a redirect when the route is incomplete.
 */
export const AdminDataRequestFeatureTypePage = () => {
  const { dataRequestId, featureType } = useParams<{ dataRequestId: string; featureType: string }>();

  if (!dataRequestId || !featureType) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <AdminDataRequestFeatureTypePageContent
      key={`${dataRequestId}/${featureType}`}
      dataRequestId={dataRequestId}
      featureType={featureType}
    />
  );
};
