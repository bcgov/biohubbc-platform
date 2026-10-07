import { useApi } from 'hooks/useApi';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { ContributorDetailPage } from './ContributorDetailPage';

vi.mock('hooks/useApi');
const get = vi.fn();
const list = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ contributor_users: [], pagination: { total: 0, last_page: 1 } });
  vi.mocked(useApi).mockReturnValue({
    contributors: { getContributor: get, listContributorUsers: list }
  } as unknown as ReturnType<typeof useApi>);
});

it('loads contributor details and scopes relationship management to the route identifier', async () => {
  get.mockResolvedValue({
    contributor_id: 7,
    client_id: 'SIMS',
    description: 'Test client',
    record_end_date: null
  });
  render(
    <MemoryRouter initialEntries={['/admin/users/contributor/7']}>
      <Routes>
        <Route path="/admin/users/contributor/:contributorId" element={<ContributorDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
  expect(await screen.findByRole('heading', { name: 'SIMS' })).toBeVisible();
  expect(get).toHaveBeenCalledWith(7);
  await waitFor(() =>
    expect(list).toHaveBeenCalledWith({ keyword: '', contributor_id: 7 }, expect.objectContaining({ page: 1 }))
  );
  expect(screen.getByRole('link', { name: 'Contributors' })).toHaveAttribute('href', '/admin/users?tab=contributors');
  expect(screen.getByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByText('Contributor ID: 7')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Metadata' }));
  const metadata = within(screen.getByRole('tabpanel', { name: 'Metadata' }));
  expect(metadata.getByRole('heading', { name: 'About' })).toBeVisible();
  expect(metadata.getByRole('row', { name: 'contributor_id 7' })).toBeVisible();
  expect(metadata.getByRole('row', { name: 'client_id SIMS' })).toBeVisible();
  expect(metadata.getByRole('row', { name: 'description Test client' })).toBeVisible();
  expect(metadata.getByRole('row', { name: 'record_end_date' })).toBeVisible();
  expect(metadata.queryByText('Status')).not.toBeInTheDocument();
  expect(metadata.queryByText(/^(create|update)_/)).not.toBeInTheDocument();
  expect(screen.queryByRole('tabpanel', { name: 'Users' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Users' }));
  expect(screen.getByRole('tabpanel', { name: 'Users' })).toBeVisible();
  expect(list).toHaveBeenCalledTimes(1);
});

it('shows a recoverable error for a missing contributor', async () => {
  get.mockRejectedValue(new Error('Contributor not found'));
  render(
    <MemoryRouter initialEntries={['/admin/users/contributor/9']}>
      <Routes>
        <Route path="/admin/users/contributor/:contributorId" element={<ContributorDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load contributor');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  expect(list).not.toHaveBeenCalled();
});
