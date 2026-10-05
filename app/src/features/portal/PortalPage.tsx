import { PageHeader } from 'components/header/PageHeader';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { TabGroup } from 'components/tabs/TabGroup';
import { useNavigate } from 'react-router-dom';
import { PortalApiKeysPage } from './PortalApiKeysPage';
import { PortalDownloadPage } from './PortalDownloadPage';
import { PortalSubmissionPage } from './PortalSubmissionPage';
import { PortalTicketPage } from './PortalTicketPage';

type PortalTab = 'tickets' | 'submissions' | 'downloads' | 'apikeys';

interface IPortalPageProps {
  initialTab?: PortalTab;
}

/**
 * Portal page with top-level tabs switching between ticket, submission, download, and API key content.
 *
 * @param {IPortalPageProps} props - Initial tab selected by the active Portal route.
 * @return {JSX.Element} The Portal header and active tab content.
 */
const PortalPage = ({ initialTab = 'downloads' }: IPortalPageProps) => {
  const navigate = useNavigate();
  const activeTab = initialTab;

  /**
   * Navigate to the canonical route for the selected Portal tab.
   *
   * @param {PortalTab} value - Selected Portal tab.
   * @return {void}
   */
  const handleTabChange = (value: PortalTab) => {
    if (value === 'tickets') {
      navigate('/portal/ticket');
    } else if (value === 'submissions') {
      navigate('/portal/submission');
    } else if (value === 'downloads') {
      navigate('/portal/download');
    } else {
      navigate('/portal/api-key');
    }
  };

  return (
    <>
      <PageHeader
        label="My Portal"
        tabs={
          <TabGroup<PortalTab>
            value={activeTab}
            onChange={handleTabChange}
            ariaLabel="Portal sections"
            tabs={[
              { value: 'downloads', label: 'Downloads' },
              { value: 'submissions', label: 'Submissions' },
              { value: 'tickets', label: 'Tickets' },
              { value: 'apikeys', label: 'API Keys' }
            ]}
          />
        }
      />
      <ComponentSwitch<PortalTab>
        switch={activeTab}
        components={{
          tickets: <PortalTicketPage />,
          submissions: <PortalSubmissionPage />,
          downloads: <PortalDownloadPage />,
          apikeys: <PortalApiKeysPage />
        }}
      />
    </>
  );
};

export default PortalPage;
