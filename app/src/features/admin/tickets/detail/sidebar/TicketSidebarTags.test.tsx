import { useApi } from 'hooks/useApi';
import { ITicketTag } from 'interfaces/useTagsApi.interface';
import { fireEvent, render, screen, within } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { useTicketTagsQuery } from '../../hooks/useTicketTagsQuery';
import { useUpdateTicketTagsMutation } from '../../hooks/useUpdateTicketTagsMutation';
import { TicketSidebarTags } from './TicketSidebarTags';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));
vi.mock('../../hooks/useTicketTagsQuery', () => ({ useTicketTagsQuery: vi.fn() }));
vi.mock('../../hooks/useUpdateTicketTagsMutation', () => ({ useUpdateTicketTagsMutation: vi.fn() }));

const ruleTag: ITicketTag = {
  tag_id: 'tag-1',
  name: 'Failed',
  color: '#D8292F',
  tag_rule_id: 'rule-1',
  tag_rule_name: 'Failed uploads'
};
const manualTag: ITicketTag = {
  tag_id: 'tag-2',
  name: 'Triage',
  color: '#FCBA19',
  tag_rule_id: null,
  tag_rule_name: null
};

describe('TicketSidebarTags', () => {
  const mutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useTicketTagsQuery as Mock).mockReturnValue({
      data: { tags: [ruleTag, manualTag], events: [] },
      isFetching: false
    });
    (useApi as Mock).mockReturnValue({
      tags: { getTags: vi.fn().mockResolvedValue({ tags: [], pagination: { total: 0 } }) }
    });
    (useUpdateTicketTagsMutation as Mock).mockReturnValue({ mutate });
  });

  /**
   * Finds the chip that shows a tag's name.
   *
   * @param {string} name The tag name.
   * @returns {HTMLElement} The tag's chip.
   */
  const getChip = (name: string) => screen.getByText(name).closest('.MuiChip-root') as HTMLElement;

  it('removes a tag a rule added like any other tag', () => {
    render(<TicketSidebarTags />);

    fireEvent.click(within(getChip('Failed')).getByTestId('CancelIcon'));

    expect(mutate).toHaveBeenCalledWith([manualTag]);
  });

  it('names the rule that added a rule tag on hover', async () => {
    render(<TicketSidebarTags />);

    fireEvent.mouseOver(getChip('Failed'));

    expect(await screen.findByRole('tooltip', { name: "Added by rule 'Failed uploads'" })).toBeVisible();
  });
});
