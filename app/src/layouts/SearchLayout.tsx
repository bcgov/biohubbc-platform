import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Footer from 'components/layout/footer/Footer';
import Header from 'components/layout/header/Header';
import { CodesContextProvider } from 'contexts/codesContext';
import { DialogContextProvider } from 'contexts/dialogContext';
import React, { PropsWithChildren } from 'react';
import { isSupportedBrowser } from 'utils/browser';

const SearchLayout = (props: PropsWithChildren) => {
  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <CssBaseline />
      <DialogContextProvider>
        <CodesContextProvider>
          {!isSupportedBrowser() && (
            <Alert severity="error">This is an unsupported browser. Some functionality may not work as expected.</Alert>
          )}

          <Header />
          <Box component="main" flex="1 1 auto" display="flex" flexDirection="column" minHeight={0}>
            {React.Children.map(props.children, (child: any) => {
              return React.cloneElement(child);
            })}
          </Box>
          <Footer />
        </CodesContextProvider>
      </DialogContextProvider>
    </Box>
  );
};

export default SearchLayout;
