import { fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import PortalPage from './PortalPage';

vi.mock('./PortalTicketPage', () => ({
  PortalTicketPage: () => <div>Ticket content</div>
}));

vi.mock('./PortalSubmissionPage', () => ({
  PortalSubmissionPage: () => <div>Submission content</div>
}));

vi.mock('./PortalDownloadPage', () => ({
  PortalDownloadPage: () => <div>Download content</div>
}));

vi.mock('./PortalApiKeysPage', () => ({
  PortalApiKeysPage: () => <div>API key content</div>
}));

/**
 * Render the Portal's tab routes with the same initial-tab mapping as PortalRouter.
 *
 * @return {ReturnType<typeof render>} Testing Library utilities for the rendered Portal.
 */
const renderPage = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={['/portal/ticket']}>
      <Routes>
        <Route path="/portal/ticket" element={<PortalPage initialTab="tickets" />} />
        <Route path="/portal/submission" element={<PortalPage initialTab="submissions" />} />
        <Route path="/portal/download" element={<PortalPage initialTab="downloads" />} />
        <Route path="/portal/api-key" element={<PortalPage initialTab="apikeys" />} />
      </Routes>
    </MemoryRouter>
  );

describe('PortalPage', () => {
  it('shows Downloads as the first tab', () => {
    const { getAllByRole } = renderPage();

    expect(getAllByRole('tab')[0]).toHaveTextContent('Downloads');
  });

  it('shows the Downloads tab and navigates to its content', async () => {
    const { getByRole, findByText } = renderPage();

    expect(getByRole('tab', { name: 'Downloads' })).toBeVisible();
    fireEvent.click(getByRole('tab', { name: 'Downloads' }));

    expect(await findByText('Download content')).toBeVisible();
    expect(getByRole('tab', { name: 'Downloads' })).toHaveAttribute('aria-selected', 'true');
  });
});
