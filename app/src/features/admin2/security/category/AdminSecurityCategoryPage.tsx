import { Navigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { AdminSecurityCategoryPageContent } from './content/AdminSecurityCategoryPageContent';

/**
 * Administrative security category page: validates the route's category id, then shows the category. The content is
 * keyed by the id so a different category starts from fresh table state.
 *
 * @returns {JSX.Element} The category page, or a redirect when the id does not identify a category.
 */
export const AdminSecurityCategoryPage = () => {
  const params = useParams<{ securityCategoryId: string }>();
  const securityCategoryId = parseRouteId(params.securityCategoryId);

  if (securityCategoryId === null) {
    return <Navigate to="/page-not-found" replace />;
  }

  return <AdminSecurityCategoryPageContent key={securityCategoryId} securityCategoryId={securityCategoryId} />;
};
