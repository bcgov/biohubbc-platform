import { useApi } from 'hooks/useApi';
import { ITagSummary } from 'interfaces/useTagsApi.interface';
import { fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TagAutocomplete } from './TagAutocomplete';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));

const urgentTag: ITagSummary = { tag_id: 'tag-1', name: 'Urgent', color: '#D8292F' };
const blockedTag: ITagSummary = { tag_id: 'tag-2', name: 'Blocked', color: '#FCBA19' };

/**
 * Builds a tags response page.
 *
 * @param {ITagSummary[]} tags The matching tags.
 * @returns The tags response.
 */
const tagsResponse = (tags: ITagSummary[]) => ({
  tags: tags.map((tag) => ({ ...tag, description: null, create_date: '2026-10-01T00:00:00.000Z' })),
  pagination: { total: tags.length, current_page: 1, last_page: 1, per_page: 50 }
});

describe('TagAutocomplete', () => {
  const getTags = vi.fn();
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getTags.mockImplementation(async ({ search }: { search: string }) =>
      tagsResponse([urgentTag, blockedTag].filter((tag) => tag.name.toLowerCase().includes(search.toLowerCase())))
    );
    (useApi as Mock).mockReturnValue({ tags: { getTags } });
  });

  it('searches the tags by the typed name, a bounded page at a time', async () => {
    render(<TagAutocomplete id="tags" placeholder="Pick tags" value={[]} onChange={onChange} />);

    await waitFor(() =>
      expect(getTags).toHaveBeenCalledWith({ search: '', page: 1, limit: 50 }, { signal: expect.any(AbortSignal) })
    );

    fireEvent.change(screen.getByPlaceholderText('Pick tags'), { target: { value: 'blo' } });

    await waitFor(() =>
      expect(getTags).toHaveBeenLastCalledWith(
        { search: 'blo', page: 1, limit: 50 },
        { signal: expect.any(AbortSignal) }
      )
    );
    expect(await screen.findByRole('option', { name: 'Blocked' })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Urgent' })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('option', { name: 'Blocked' }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining(blockedTag)]);
  });

  it('keeps showing picked tags that the current search does not match', async () => {
    getTags.mockResolvedValue(tagsResponse([blockedTag]));
    render(<TagAutocomplete id="tags" value={[urgentTag]} onChange={onChange} />);

    expect(within(screen.getByTestId('tags')).getByText('Urgent')).toBeVisible();

    fireEvent.mouseDown(screen.getByRole('combobox'));

    expect(await screen.findByRole('option', { name: 'Blocked' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Urgent' })).toHaveAttribute('aria-selected', 'true');
  });
});
