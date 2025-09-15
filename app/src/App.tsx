import CircularProgress from '@mui/material/CircularProgress';
import { ThemeProvider } from '@mui/material/styles';
import { getConfig } from 'config/config';
import { AuthStateContext, AuthStateContextProvider } from 'contexts/authStateContext';
import { WebStorageStateStore } from 'oidc-client-ts';
import { AuthProvider, AuthProviderProps } from 'react-oidc-context';
import { BrowserRouter } from 'react-router';
import { AppRouter } from 'router/AppRouter';
import appTheme from 'themes/appTheme';
import { buildUrl } from 'utils/Utils';

const App = () => {
  // Get environment variables
  const config = getConfig();

  // Format logout redirect URI
  const logoutRedirectUri = config.SITEMINDER_LOGOUT_URL
    ? `${config.SITEMINDER_LOGOUT_URL}?returl=${window.location.origin}&retnow=1`
    : buildUrl(window.location.origin);

  // Build authConfig
  const authConfig: AuthProviderProps = {
    authority: `${config.KEYCLOAK_CONFIG.authority}/realms/${config.KEYCLOAK_CONFIG.realm}/`,
    client_id: config.KEYCLOAK_CONFIG.clientId,
    resource: config.KEYCLOAK_CONFIG.clientId,
    redirect_uri: buildUrl(window.location.origin),
    post_logout_redirect_uri: logoutRedirectUri,
    loadUserInfo: true,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    onSigninCallback: () => {
      // Clean up URL after signin. See https://github.com/authts/react-oidc-context#getting-started
      // window.history.replaceState({}, document.title, window.location.pathname);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  return (
    <ThemeProvider theme={appTheme}>
      <AuthProvider {...authConfig}>
        <AuthStateContextProvider>
          <AuthStateContext.Consumer>
            {(authState) => {
              // Show loading state if auth is undefined or the user's data is loading
              if (!authState || authState.biohubUserWrapper.isLoading) {
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
    </ThemeProvider>
  );
};

export default App;
