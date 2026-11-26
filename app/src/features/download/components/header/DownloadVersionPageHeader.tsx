import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { PageHeader } from 'components/header/PageHeader';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { PORTAL_DOWNLOAD_BASE_PATH } from 'constants/download';
import { DownloadDetail, DownloadVersion } from 'interfaces/useDownloadApi.interface';
import { Link as RouterLink } from 'react-router';
import { getFormattedDate } from 'utils/Utils';
import { DownloadVersionExportButton } from '../DownloadVersionExportButton';

type DownloadVersionTab = 'features' | 'exports';

interface DownloadVersionPageHeaderProps {
  download: DownloadDetail;
  version: DownloadVersion;
  /** Base route the page is served under, either the open or the Portal download route. */
  basePath: string;
  activeTab: DownloadVersionTab;
  onTabChange: (tab: DownloadVersionTab) => void;
}

/**
 * Renders the selected version breadcrumb, export action, and content tabs.
 *
 * The Portal trail is shown only under the Portal route: the open route also serves anonymous
 * download links, whose users cannot open the Portal.
 *
 * @param {DownloadVersionPageHeaderProps} props - Download, version, base route, and active-tab header state.
 * @return {JSX.Element} The download version page header.
 */
export const DownloadVersionPageHeader = ({
  download,
  version,
  basePath,
  activeTab,
  onTabChange
}: DownloadVersionPageHeaderProps) => (
  <PageHeader
    breadcrumbs={
      <Breadcrumbs aria-label="download version breadcrumb">
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
        <Link component={RouterLink} to={`${basePath}/${download.download_id}`} underline="hover" color="inherit">
          {download.name}
        </Link>
        <Link component="span" underline="hover" color="inherit" aria-current="page">
          {getFormattedDate(DATE_FORMAT.MediumDateFormat, version.create_date)}
        </Link>
      </Breadcrumbs>
    }
    label={download.name}
    subheader={download.description}
    buttons={
      <DownloadVersionExportButton
        downloadId={download.download_id}
        downloadVersionId={version.download_version_id}
        status={version.status}
      />
    }
    tabs={
      <Tabs value={activeTab} onChange={(_, value) => onTabChange(value)} aria-label="download version tabs">
        <Tab
          value="features"
          label="Features"
          id="download-version-features-tab"
          aria-controls="download-version-features"
        />
        <Tab
          value="exports"
          label="Exports"
          id="download-version-exports-tab"
          aria-controls="download-version-exports"
        />
      </Tabs>
    }
  />
);
