import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { PageHeader } from 'components/header/PageHeader';
import { PORTAL_DOWNLOAD_BASE_PATH } from 'constants/download';
import { DownloadDetail } from 'interfaces/useDownloadApi.interface';
import { Link as RouterLink } from 'react-router';

interface DownloadPageHeaderProps {
  download: DownloadDetail;
  /** Base route the page is served under, either the open or the Portal download route. */
  basePath: string;
}

/**
 * Renders the download breadcrumb, title, description, and Versions tab.
 *
 * The Portal trail is shown only under the Portal route: the open route also serves anonymous
 * download links, whose users cannot open the Portal.
 *
 * @param {DownloadPageHeaderProps} props - Download data and the base route displayed by the header.
 * @return {JSX.Element} The download page header.
 */
export const DownloadPageHeader = ({ download, basePath }: DownloadPageHeaderProps) => (
  <PageHeader
    breadcrumbs={
      <Breadcrumbs aria-label="download breadcrumb">
        {basePath === PORTAL_DOWNLOAD_BASE_PATH && (
          <Link component={RouterLink} to="/portal" underline="hover" color="inherit">
            Portal
          </Link>
        )}
        {basePath === PORTAL_DOWNLOAD_BASE_PATH && (
          <Link component={RouterLink} to={PORTAL_DOWNLOAD_BASE_PATH} underline="hover" color="inherit">
            Downloads
          </Link>
        )}
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
