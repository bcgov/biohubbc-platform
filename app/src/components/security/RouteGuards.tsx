import CircularProgress from '@mui/material/CircularProgress';
import { AuthStateContext } from 'contexts/authStateContext';
import qs from 'qs';
import React, { useContext } from 'react';
import { Redirect, Route, RouteProps, useLocation } from 'react-router';

/**
 * Special route guard that requires the user to be authenticated, but also accounts for routes that are exceptions to
 * requiring authentication, and accounts for the case where a user can authenticate, but has not yet been granted
 * application access.
 *
 * Only relevant on top-level routers. Child routers can leverage regular guards.
 *
 * @param {*} { children, ...rest }
 * @return {*}
 */
export const AuthenticatedRouteGuard: React.FC<React.PropsWithChildren<RouteProps>> = ({ children, ...rest }) => {
  return (
    <CheckForAuthLoginParam>
      <WaitForKeycloakToLoadUserInfo>
        <CheckIfAuthenticatedUser>
          <Route
            {...rest}
            render={(props) => {
              return (
                <>
                  {React.Children.map(children, (child: any) => {
                    return React.cloneElement(child, props);
                  })}
                </>
              );
            }}
          />
        </CheckIfAuthenticatedUser>
      </WaitForKeycloakToLoadUserInfo>
    </CheckForAuthLoginParam>
  );
};

/**
 * Checks for query param `authLogin=true`. If set, force redirect the user to the keycloak login page.
 *
 * Redirects the user as appropriate, or renders the `children`.
 *
 * @param {*} { children }
 * @return {*}
 */
const CheckForAuthLoginParam: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { keycloakWrapper } = useContext(AuthStateContext);

  const location = useLocation();

  if (!keycloakWrapper?.keycloak.authenticated) {
    const urlParams = qs.parse(location.search, { ignoreQueryPrefix: true });
    const authLoginUrlParam = urlParams.authLogin;
    // check for urlParam to force login
    if (authLoginUrlParam) {
      // remove authLogin url param from url to stop possible loop redirect
      const redirectUrlParams = qs.stringify(urlParams, { filter: (prefix) => prefix !== 'authLogin' });
      const redirectUri = `${window.location.origin}${location.pathname}?${redirectUrlParams}`;

      // trigger login
      keycloakWrapper?.keycloak.login({ redirectUri: redirectUri });
    }

    return <Redirect to="/" />;
  }

  return <>{children}</>;
};

/**
 * Waits for the keycloakWrapper to finish loading user info.
 *
 * Renders a spinner or the `children`.
 *
 * @param {*} { children }
 * @return {*}
 */
const WaitForKeycloakToLoadUserInfo: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { keycloakWrapper } = useContext(AuthStateContext);

  if (!keycloakWrapper?.hasLoadedAllUserInfo) {
    // User data has not been loaded, can not yet determine if user has sufficient roles
    return <CircularProgress className="pageProgress" size={40} />;
  }

  return <>{children}</>;
};

/**
 * Checks if the user is a registered user.
 *
 * Redirects the user as appropriate, or renders the `children`.
 *
 * @param {*} { children }
 * @return {*}
 */
const CheckIfAuthenticatedUser: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { keycloakWrapper } = useContext(AuthStateContext);

  const location = useLocation();

  if (!keycloakWrapper?.systemUserId) {
    // User is not a registered system user
    if (location.pathname !== '/logout') {
      // User attempted to go to restricted page
      return <Redirect to="/forbidden" />;
    }
  }

  return <>{children}</>;
};
