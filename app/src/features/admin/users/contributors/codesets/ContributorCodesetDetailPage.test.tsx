import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from 'test-helpers/test-utils';
import { ContributorCodesetDetailPage } from './ContributorCodesetDetailPage';

vi.mock('hooks/useApi');
const getContributor = vi.fn();
const getCodeset = vi.fn();
const listCodes = vi.fn();

/**
 * Render the codeset page at a contributor-scoped codeset URL.
 *
 * @returns Rendered page.
 */
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/users/contributor/7/codeset/10']}>
      <Routes>
        <Route
          path="/admin/users/contributor/:contributorId/codeset/:contributorCodesetId"
          element={<ContributorCodesetDetailPage />}
        />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  getContributor.mockResolvedValue({ contributor_id: 7, client_id: 'SIMS', description: null, record_end_date: null });
  listCodes.mockResolvedValue({
    codes: [
      {
        contributor_codeset_code_id: 100,
        contributor_codeset_id: 10,
        codeset_label: 'Life stage',
        key: 'juvenile',
        label: 'Juvenile',
        description: null,
        external_id: 'v1',
        record_end_date: '2026-01-01'
      }
    ],
    pagination: { total: 1, last_page: 1 }
  });
  vi.mocked(useApi).mockReturnValue({
    contributors: {
      getContributor,
      getContributorCodeset: getCodeset,
      listContributorCodesetCodes: listCodes
    }
  } as unknown as ReturnType<typeof useApi>);
});

it("lists the codeset's codes without management actions and links back to the contributor's codesets", async () => {
  getCodeset.mockResolvedValue({
    contributor_codeset_id: 10,
    contributor_id: 7,
    key: 'life-stage',
    label: 'Life stage',
    description: null,
    external_id: 'v1',
    record_end_date: null
  });
  renderPage();

  expect(await screen.findByRole('heading', { name: 'Life stage' })).toBeVisible();
  expect(getCodeset).toHaveBeenCalledWith(7, 10);
  expect(screen.getByRole('tab', { name: 'Codes' })).toHaveAttribute('aria-selected', 'true');
  expect(await screen.findByRole('gridcell', { name: 'juvenile' })).toBeVisible();
  expect(listCodes).toHaveBeenCalledWith(7, 10, expect.objectContaining({ page: 1 }));
  expect(screen.getByText('Ended')).toBeVisible();
  expect(await screen.findByRole('link', { name: 'SIMS' })).toHaveAttribute(
    'href',
    '/admin/users/contributor/7?tab=codesets'
  );
  expect(screen.queryByRole('button', { name: /add|edit|delete|actions/i })).not.toBeInTheDocument();
});

it('shows a recoverable error for a codeset the contributor does not have', async () => {
  getCodeset.mockRejectedValue(new Error('Code category not found'));
  renderPage();

  expect(await screen.findByText('Unable to load codeset. It may not exist for this contributor.')).toBeVisible();
  await waitFor(() => expect(listCodes).not.toHaveBeenCalled());
});
