import { PageHeader } from 'components/header/PageHeader';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { TabGroup } from 'components/tabs/TabGroup';
import { useNavigate } from 'react-router-dom';
import { PortalSubmissionPage } from './PortalSubmissionPage';
import { PortalTicketPage } from './PortalTicketPage';

type PortalTab = 'tickets' | 'submissions';

interface IPortalPageProps {
  initialTab?: PortalTab;
}

/**
 * Portal page with top-level tabs switching between ticket and submission content.
 */
const PortalPage = ({ initialTab = 'tickets' }: IPortalPageProps) => {
  const navigate = useNavigate();
  const activeTab = initialTab;

  const handleTabChange = (value: PortalTab) => {
    navigate(value === 'tickets' ? '/portal/ticket' : '/portal/submission');
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
              { value: 'submissions', label: 'Submissions' }
            ]}
          />
        }
      />
      <ComponentSwitch<PortalTab>
        switch={activeTab}
        components={{
          tickets: <PortalTicketPage />,
          submissions: <PortalSubmissionPage />
        }}
      />
    </>
  );
};

export default PortalPage;
