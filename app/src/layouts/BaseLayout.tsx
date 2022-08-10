import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Alert from '@mui/lab/Alert';
import Footer from 'components/layout/footer/Footer';
import Header from 'components/layout/header/Header';
import { DialogContextProvider } from 'contexts/dialogContext';
import React from 'react';

const BaseLayout: React.FC<React.PropsWithChildren> = (props) => {
  function isSupportedBrowser() {
    if (
      navigator.userAgent.indexOf('Chrome') !== -1 ||
      navigator.userAgent.indexOf('Firefox') !== -1 ||
      navigator.userAgent.indexOf('Safari') !== -1 ||
      navigator.userAgent.indexOf('Edge') !== -1
    ) {
      return true;
    }

    return false;
  }

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <CssBaseline />
      <DialogContextProvider>
        {!isSupportedBrowser() && (
          <Alert severity="error">This is an unsupported browser. Some functionality may not work as expected.</Alert>
        )}

        <Header />

        <Box component="main" flex="1 1 auto">
          {React.Children.map(props.children, (child: any) => {
            return React.cloneElement(child);
          })}
        </Box>

        <Footer />
      </DialogContextProvider>
    </Box>
  );
};

export default BaseLayout;
