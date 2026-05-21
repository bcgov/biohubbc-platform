import { PageHeader } from 'components/header/PageHeader';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { TabGroup } from 'components/tabs/TabGroup';
import { useNavigate } from 'react-router-dom';
import { PortalApiKeysPage } from './PortalApiKeysPage';
import { PortalSubmissionPage } from './PortalSubmissionPage';
import { PortalTicketPage } from './PortalTicketPage';

type PortalTab = 'tickets' | 'submissions' | 'apikeys';

interface IPortalPageProps {
  initialTab?: PortalTab;
}

/**
 * Portal page with top-level tabs switching between ticket, submission, and API key content.
 */
const PortalPage = ({ initialTab = 'tickets' }: IPortalPageProps) => {
  const navigate = useNavigate();
  const activeTab = initialTab;

  const handleTabChange = (value: PortalTab) => {
    if (value === 'tickets') {
      navigate('/portal/ticket');
    } else if (value === 'submissions') {
      navigate('/portal/submission');
    } else {
      navigate('/portal/api-keys');
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
              { value: 'tickets', label: 'Tickets' },
              { value: 'submissions', label: 'Submissions' },
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
          apikeys: <PortalApiKeysPage />
        }}
      />
    </>
  );
};

export default PortalPage;
