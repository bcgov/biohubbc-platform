import CircularProgress from '@mui/material/CircularProgress';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useEffect } from 'react';
import { hasAuthParams } from 'react-oidc-context';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { buildUrl } from 'utils/Utils';

/**
 * Route guard that requires the user to be authenticated and registered with BioHub.
 *
 * @param {RouteProps} props
 * @return {*}
 */
export const AuthenticatedRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const authStateContext = useAuthStateContext();
  const location = useLocation();

  useEffect(() => {
    if (
      !authStateContext.auth.isLoading &&
      !hasAuthParams() &&
      !authStateContext.auth.isAuthenticated &&
      !authStateContext.auth.activeNavigator
    ) {
      // User is not authenticated and has no active authentication navigator, redirect to the keycloak login page
      authStateContext.auth.signinRedirect({ redirect_uri: buildUrl(window.location.origin, location.pathname) });
    }
  }, [authStateContext.auth, location.pathname]);

  if (
    authStateContext.auth.isLoading ||
    authStateContext.biohubUserWrapper.isLoading ||
    !authStateContext.auth.isAuthenticated
  ) {
    return <CircularProgress className="pageProgress" data-testid="authenticated-route-guard-spinner" />;
  }

  if (!authStateContext.biohubUserWrapper.systemUserId) {
    // Redirect to forbidden page
    return <Navigate to="/forbidden" replace />;
  }

  // The user is a registered system user
  return <>{children || <Outlet />}</>;
};
