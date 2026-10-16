import { Navigate, useParams } from 'react-router-dom';
import { AdminDataRequestPageContent } from './content/AdminDataRequestPageContent';

/**
 * Administrative data request page: reads the route's data request id, then shows the data request. The content is
 * keyed by the id so a different data request starts from fresh state.
 *
 * @returns {JSX.Element} The data request page, or a redirect when the route has no id.
 */
export const AdminDataRequestPage = () => {
  const { dataRequestId } = useParams<{ dataRequestId: string }>();

  if (!dataRequestId) {
    return <Navigate to="/page-not-found" replace />;
  }

  return <AdminDataRequestPageContent key={dataRequestId} dataRequestId={dataRequestId} />;
};
