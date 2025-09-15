import CircularProgress from '@mui/material/CircularProgress';
import { ThemeProvider } from '@mui/material/styles';
import { getConfig } from 'config/config';
import { AuthStateContext, AuthStateContextProvider } from 'contexts/authStateContext';
import { WebStorageStateStore } from 'oidc-client-ts';
import { AuthProvider, AuthProviderProps } from 'react-oidc-context';
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
      // Clean up URL after signin
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  return (
    <ThemeProvider theme={appTheme}>
      <AuthProvider {...authConfig}>
        <AuthStateContextProvider>
          <AuthStateContext.Consumer>
            {(authState) => {
              if (!authState || authState.auth.isLoading) {
                return <CircularProgress className="pageProgress" size={40} />;
              }

              return <AppRouter />;
            }}
          </AuthStateContext.Consumer>
        </AuthStateContextProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
