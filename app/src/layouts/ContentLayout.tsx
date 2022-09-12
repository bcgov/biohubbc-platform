import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Header from 'components/layout/header/Header';
import { DialogContextProvider } from 'contexts/dialogContext';
import React from 'react';

const ContentLayout: React.FC<React.PropsWithChildren> = (props) => {
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

        <Box component="main" flex="1 1 auto" overflow="hidden">
          {React.Children.map(props.children, (child: any) => {
            return React.cloneElement(child);
          })}
        </Box>

      </DialogContextProvider>
    </Box>
  );
};

export default ContentLayout;