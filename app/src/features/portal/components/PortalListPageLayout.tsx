import Container from '@mui/material/Container';
import { PropsWithChildren } from 'react';

/**
 * Shared layout wrapper for portal list pages.
 */
export const PortalListPageLayout = ({ children }: PropsWithChildren) => {
  return (
    <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
      {children}
    </Container>
  );
};
