import Breadcrumbs from '@mui/material/Breadcrumbs';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { PropsWithChildren } from 'react';
import { Link as RouterLink } from 'react-router-dom';

export interface IPortalPageLayoutProps {
  /** Page title, also shown as the current breadcrumb under the Portal landing page. */
  title: string;
}

/**
 * Shared layout of a portal section page: a header with a breadcrumb back to the Portal landing page and the section
 * title, above the section's content.
 *
 * @param {PropsWithChildren<IPortalPageLayoutProps>} props
 * @returns {JSX.Element} Portal section header and content.
 */
export const PortalPageLayout = (props: PropsWithChildren<IPortalPageLayoutProps>) => {
  const { title, children } = props;

  return (
    <>
      <PageHeader
        label={title}
        breadcrumbs={
          <Breadcrumbs aria-label={`${title} breadcrumb`}>
            <Link component={RouterLink} to="/portal" underline="hover" color="inherit">
              Portal
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              {title}
            </Typography>
          </Breadcrumbs>
        }
      />

      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        {children}
      </Container>
    </>
  );
};
