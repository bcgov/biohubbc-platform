import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor, fireEvent } from 'test-helpers/test-utils';
import { ContributorUserActions } from '../table/ContributorUserActions';
import { ContributorPanel } from './ContributorPanel';
import { ContributorUserPanel } from './ContributorUserPanel';

vi.mock('hooks/useApi');
const list = vi.fn();
const listUsers = vi.fn();
const contributor = {
  contributor_id: 1,
  client_id: 'SIMS',
  description: 'Description',
  record_end_date: null
};

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ contributors: [contributor], pagination: { total: 1, last_page: 1 } });
  listUsers.mockResolvedValue({ contributor_users: [], pagination: { total: 0, last_page: 1 } });
  vi.mocked(useApi).mockReturnValue({
    contributors: { listContributors: list, listContributorUsers: listUsers }
  } as unknown as ReturnType<typeof useApi>);
});

it('renders contributor fields and navigates through the required detail URL', async () => {
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<ContributorPanel />} />
        <Route path="/admin/users/contributor/1" element={<div>Contributor details</div>} />
      </Routes>
    </MemoryRouter>
  );
  const clientCell = await screen.findByRole('gridcell', { name: 'SIMS' });
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByText('Description', { selector: 'div.MuiDataGrid-cell' })).toBeVisible();
  expect(screen.getByText('Active')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Add Contributor' }));
  expect(await screen.findByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(clientCell);
  expect(await screen.findByText('Contributor details')).toBeVisible();
});

it('scopes the detail relationship list and disables additions after contributor deletion', async () => {
  render(
    <MemoryRouter>
      <ContributorUserPanel contributor={{ ...contributor, record_end_date: '2026-01-01' }} />
    </MemoryRouter>
  );
  await waitFor(() =>
    expect(listUsers).toHaveBeenCalledWith({ keyword: '', contributor_id: 1 }, expect.objectContaining({ page: 1 }))
  );
  expect(screen.queryByRole('button', { name: 'Add Contributor User' })).not.toBeInTheDocument();
});

it('provides no edit or delete actions for ended relationships', () => {
  render(
    <ContributorUserActions
      record={{
        contributor_system_user_id: 1,
        contributor_id: 1,
        system_user_id: 2,
        client_id: 'SIMS',
        user_identifier: 'user',
        display_name: null,
        record_end_date: '2026-01-01'
      }}
      onChanged={vi.fn()}
    />
  );
  expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
});
