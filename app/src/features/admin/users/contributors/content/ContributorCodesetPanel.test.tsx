import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen } from 'test-helpers/test-utils';
import { ContributorCodesetPanel } from './ContributorCodesetPanel';

vi.mock('hooks/useApi');
const listCodesets = vi.fn();
const contributor = { contributor_id: 1, client_id: 'SIMS', description: null, record_end_date: null };

beforeEach(() => {
  vi.clearAllMocks();
  listCodesets.mockResolvedValue({
    codesets: [
      {
        contributor_codeset_id: 10,
        contributor_id: 1,
        key: 'life-stage',
        label: 'Life stage',
        description: 'Animal life stage',
        external_id: 'v1',
        record_end_date: null
      },
      {
        contributor_codeset_id: 11,
        contributor_id: 1,
        key: 'sex',
        label: 'Sex',
        description: null,
        external_id: 'v1',
        record_end_date: '2026-01-01'
      }
    ],
    pagination: { total: 2, last_page: 1 }
  });
  vi.mocked(useApi).mockReturnValue({
    contributors: { listContributorCodesets: listCodesets }
  } as unknown as ReturnType<typeof useApi>);
});

it("lists the contributor's codesets without management actions and opens a selected codeset", async () => {
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<ContributorCodesetPanel contributor={contributor} />} />
        <Route path="/admin/users/contributor/1/codeset/10" element={<div>Codeset details</div>} />
      </Routes>
    </MemoryRouter>
  );

  const codesetCell = await screen.findByRole('gridcell', { name: 'life-stage' });
  expect(listCodesets).toHaveBeenCalledWith(1, expect.objectContaining({ page: 1 }));
  expect(screen.getByText('Active')).toBeVisible();
  expect(screen.getByText('Ended')).toBeVisible();
  expect(screen.queryByRole('button', { name: /add|edit|delete|actions/i })).not.toBeInTheDocument();

  fireEvent.click(codesetCell);

  expect(await screen.findByText('Codeset details')).toBeVisible();
});
