import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { PortalPage } from './PortalPage';

describe('PortalPage', () => {
  it('links to every portal section in order', () => {
    const { getByRole, getAllByRole } = render(
      <MemoryRouter initialEntries={['/portal']}>
        <PortalPage />
      </MemoryRouter>
    );

    expect(getByRole('heading', { name: 'Portal' })).toBeVisible();
    expect(getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Submissions', '/portal/submission'],
      ['Downloads', '/portal/download'],
      ['Data Requests', '/portal/data-request'],
      ['Tickets', '/portal/ticket'],
      ['API Keys', '/portal/api-key']
    ]);
  });
});
