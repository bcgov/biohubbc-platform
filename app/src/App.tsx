import CircularProgress from '@mui/material/CircularProgress';
import { ThemeProvider } from '@mui/material/styles';
import { AuthStateContext, AuthStateContextProvider } from 'contexts/authStateContext';
import { ConfigContext, ConfigContextProvider } from 'contexts/configContext';
import { WebStorageStateStore } from 'oidc-client-ts';
import { AuthProvider, AuthProviderProps } from 'react-oidc-context';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from 'router/AppRouter';
import appTheme from 'themes/appTheme';
import { buildUrl, getPostLoginReturnTo, stripOidcParams } from 'utils/Utils';

const App = () => {
  return (
    <ThemeProvider theme={appTheme}>
      <ConfigContextProvider>
        <ConfigContext.Consumer>
          {(config) => {
            if (!config) {
              return <CircularProgress className="pageProgress" size={40} />;
            }

            const logoutRedirectUri = config.SITEMINDER_LOGOUT_URL
              ? `${config.SITEMINDER_LOGOUT_URL}?returl=${window.location.origin}&retnow=1`
              : buildUrl(window.location.origin);

            const authConfig: AuthProviderProps = {
              authority: `${config.KEYCLOAK_CONFIG.authority}/realms/${config.KEYCLOAK_CONFIG.realm}/`,
              client_id: config.KEYCLOAK_CONFIG.clientId,
<<<<<<< HEAD
              //resource: config.KEYCLOAK_CONFIG.clientId,
=======
>>>>>>> 5efc1c069764919342841b8d61570850aa6d9168
              // Default sign in redirect
              redirect_uri: buildUrl(window.location.origin),
              // Default sign out redirect
              post_logout_redirect_uri: logoutRedirectUri,
              // Automatically load additional user profile information
              loadUserInfo: true,
              userStore: new WebStorageStateStore({ store: window.localStorage }),
              onSigninCallback: (user): void => {
                // See https://github.com/authts/react-oidc-context#getting-started
                // When a caller carried a return location via the OIDC `state` param (e.g. the
                // unauthenticated "Request Access" flow), navigate to it — the registered redirect_uri is a
                // fixed origin, so login otherwise lands on `/`. A full navigation lets React Router render
                // the search route fresh; the captured returnTo carries no OIDC params, so it won't re-trigger.
                const returnTo = getPostLoginReturnTo(user);
                if (returnTo) {
                  globalThis.location.replace(returnTo);
                  return;
                }
                // Otherwise strip only the OIDC response params so any original search params on the
                // return URL (e.g. the encoded `expr` search expression) are preserved.
                globalThis.history.replaceState({}, document.title, stripOidcParams(globalThis.location.href));
              }
            };

            return (
              <AuthProvider {...authConfig}>
                <AuthStateContextProvider>
                  <AuthStateContext.Consumer>
                    {(authState) => {
                      if (!authState || authState.auth.isLoading) {
                        return <CircularProgress className="pageProgress" size={40} />;
                      }
                      return (
                        <BrowserRouter>
                          <AppRouter />
                        </BrowserRouter>
                      );
                    }}
                  </AuthStateContext.Consumer>
                </AuthStateContextProvider>
              </AuthProvider>
            );
          }}
        </ConfigContext.Consumer>
      </ConfigContextProvider>
    </ThemeProvider>
  );
};

export default App;
