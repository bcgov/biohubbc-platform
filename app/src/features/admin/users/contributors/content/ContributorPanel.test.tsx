import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from 'test-helpers/test-utils';
import { ContributorPanel } from './ContributorPanel';

vi.mock('hooks/useApi');
const list = vi.fn();
const contributor = {
  contributor_id: 1,
  client_id: 'SIMS',
  description: 'Description',
  record_end_date: null
};

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ contributors: [contributor], pagination: { total: 1, last_page: 1 } });
  vi.mocked(useApi).mockReturnValue({
    contributors: { listContributors: list }
  } as unknown as ReturnType<typeof useApi>);
});

it('renders contributor fields and opens the creation dialog', async () => {
  render(
    <MemoryRouter>
      <ContributorPanel />
    </MemoryRouter>
  );
  expect(await screen.findByRole('gridcell', { name: 'SIMS' })).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByText('Description', { selector: 'div.MuiDataGrid-cell' })).toBeVisible();
  expect(screen.getByText('Active')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Add Contributor' }));
  expect(await screen.findByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
});
