import CircularProgress from '@mui/material/CircularProgress';
import { ThemeProvider } from '@mui/material/styles';
import { ReactKeycloakProvider } from '@react-keycloak/web';
import AppRouter from 'AppRouter';
import { AuthStateContextProvider } from 'contexts/authStateContext';
import { ConfigContext, ConfigContextProvider } from 'contexts/configContext';
import Keycloak from 'keycloak-js';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import appTheme from 'themes/appTheme';

const App: React.FC<React.PropsWithChildren> = () => {
  return (
    <ThemeProvider theme={appTheme}>
      <ConfigContextProvider>
        <ConfigContext.Consumer>
          {(config) => {
            if (!config) {
              return <CircularProgress className="pageProgress" size={40} />;
            }

            const keycloak = new Keycloak(config.KEYCLOAK_CONFIG);

            return (
              <ReactKeycloakProvider
                authClient={keycloak}
                initOptions={{ pkceMethod: 'S256' }}
                LoadingComponent={<CircularProgress className="pageProgress" size={40} />}>
                <AuthStateContextProvider>
                  <BrowserRouter>
                    <AppRouter />
                  </BrowserRouter>
                </AuthStateContextProvider>
              </ReactKeycloakProvider>
            );
          }}
        </ConfigContext.Consumer>
      </ConfigContextProvider>
    </ThemeProvider>
  );
};

export default App;
