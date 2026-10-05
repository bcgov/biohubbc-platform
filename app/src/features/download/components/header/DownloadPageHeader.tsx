import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { PageHeader } from 'components/header/PageHeader';
import { DownloadDetail } from 'interfaces/useDownloadApi.interface';
import { Link as RouterLink } from 'react-router';

interface DownloadPageHeaderProps {
  download: DownloadDetail;
}

/**
 * Renders the download breadcrumb, title, description, and Versions tab.
 *
 * @param {DownloadPageHeaderProps} props - Download data displayed by the header.
 * @return {JSX.Element} The download page header.
 */
export const DownloadPageHeader = ({ download }: DownloadPageHeaderProps) => (
  <PageHeader
    breadcrumbs={
      <Breadcrumbs aria-label="download breadcrumb">
        <Link component={RouterLink} to="/portal/downloads" underline="hover" color="inherit">
          Downloads
        </Link>
        <Link component="span" underline="hover" color="inherit" aria-current="page">
          {download.name}
        </Link>
      </Breadcrumbs>
    }
    label={download.name}
    subheader={download.description}
    tabs={
      <Tabs value="versions" aria-label="download tabs">
        <Tab value="versions" label="Versions" id="download-versions-tab" aria-controls="download-versions" />
      </Tabs>
    }
  />
);
