import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ITag } from 'interfaces/useTagsApi.interface';
import { ITagRule } from 'interfaces/useTagRulesApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { AdminTagPage } from './AdminTagPage';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));
vi.mock('hooks/useContext', () => ({ useDialogContext: vi.fn() }));

const tagId = '11111111-1111-4111-8111-111111111111';

const tag: ITag = {
  tag_id: tagId,
  name: 'Urgent',
  description: 'Needs attention today',
  color: '#D8292F',
  create_date: '2026-10-01T00:00:00.000Z'
};

const tagRule: ITagRule = {
  tag_rule_id: '22222222-2222-4222-8222-222222222222',
  tag_id: tagId,
  name: 'Moose surveys',
  description: 'Uploads and requests about moose',
  is_enabled: true,
  expression_id: '33333333-3333-4333-8333-333333333333',
  create_date: '2026-10-01T00:00:00.000Z'
};

/**
 * Renders the tag page at the tag's route.
 *
 * @returns The RTL render result.
 */
const renderTagPage = () =>
  render(
    <MemoryRouter initialEntries={[`/admin/tickets/tags/${tagId}`]}>
      <Routes>
        <Route path="/admin/tickets/tags/:tagId" element={<AdminTagPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('AdminTagPage', () => {
  const getTag = vi.fn();
  const getTagRules = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getTag.mockResolvedValue(tag);
    getTagRules.mockResolvedValue({
      tag_rules: [tagRule],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
    (useApi as Mock).mockReturnValue({ tags: { getTag }, tagRules: { getTagRules } });
    (useDialogContext as Mock).mockReturnValue({ setSnackbar: vi.fn() });
  });

  it('shows the tag with its breadcrumbs, description and only a Rules tab', async () => {
    renderTagPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Urgent' })).toBeVisible();
    expect(getTag).toHaveBeenCalledWith(tagId, { signal: expect.any(AbortSignal) });
    expect(screen.getByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/admin/tickets');
    expect(screen.getByRole('link', { name: 'Tags' })).toHaveAttribute('href', '/admin/tickets?tab=tags');
    expect(screen.getByText('Needs attention today')).toBeVisible();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Rules']);
    expect(screen.getByRole('tab', { name: 'Rules' })).toHaveAttribute('aria-selected', 'true');
  });

  it("lists one page of the tag's rules", async () => {
    renderTagPage();

    expect(await screen.findByText('Moose surveys')).toBeVisible();
    await waitFor(() =>
      expect(getTagRules).toHaveBeenCalledWith(
        tagId,
        { page: 1, limit: 10, sort: 'name', order: 'asc' },
        { signal: expect.any(AbortSignal) }
      )
    );
  });
});
