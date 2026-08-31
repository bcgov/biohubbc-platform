import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { PageHeader } from 'components/header/PageHeader';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { DownloadDetail, DownloadVersion } from 'interfaces/useDownloadApi.interface';
import { Link as RouterLink } from 'react-router';
import { getFormattedDate } from 'utils/Utils';
import { DownloadVersionExportButton } from '../DownloadVersionExportButton';

type DownloadVersionTab = 'features' | 'exports';

interface DownloadVersionPageHeaderProps {
  download: DownloadDetail;
  version: DownloadVersion;
  activeTab: DownloadVersionTab;
  onTabChange: (tab: DownloadVersionTab) => void;
}

/**
 * Renders the selected version breadcrumb, export action, and content tabs.
 *
 * @param {DownloadVersionPageHeaderProps} props - Download, version, and active-tab header state.
 * @return {JSX.Element} The download version page header.
 */
export const DownloadVersionPageHeader = ({
  download,
  version,
  activeTab,
  onTabChange
}: DownloadVersionPageHeaderProps) => (
  <PageHeader
    breadcrumbs={
      <Breadcrumbs aria-label="download version breadcrumb">
        <Link component={RouterLink} to="/downloads" underline="hover" color="inherit">
          Downloads
        </Link>
        <Link component={RouterLink} to={`/download/${download.download_id}`} underline="hover" color="inherit">
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
