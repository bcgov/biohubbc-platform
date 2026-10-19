import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ITagRule } from 'interfaces/useTagRulesApi.interface';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { AdminTagRulesPage } from './AdminTagRulesPage';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));
vi.mock('hooks/useContext', () => ({ useDialogContext: vi.fn() }));

const tagRule: ITagRule = {
  tag_rule_id: '11111111-1111-4111-8111-111111111111',
  tag_id: '22222222-2222-4222-8222-222222222222',
  tag_name: 'Urgent',
  tag_color: '#D8292F',
  name: 'Failed uploads',
  description: null,
  is_enabled: true,
  expression_id: '33333333-3333-4333-8333-333333333333',
  create_date: '2026-10-01T00:00:00.000Z'
};

describe('AdminTagRulesPage', () => {
  const getTagRules = vi.fn();
  const deleteTagRule = vi.fn();
  const setSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getTagRules.mockResolvedValue({ tag_rules: [tagRule] });
    deleteTagRule.mockResolvedValue(undefined);
    (useApi as Mock).mockReturnValue({ tagRules: { getTagRules, deleteTagRule } });
    (useDialogContext as Mock).mockReturnValue({ setSnackbar });
  });

  /**
   * Renders the tag rules page.
   *
   * @returns The RTL render result.
   */
  const renderPage = () =>
    render(
      <MemoryRouter>
        <AdminTagRulesPage />
      </MemoryRouter>
    );

  /**
   * Opens the delete confirmation of the only listed rule.
   *
   * @returns {Promise<HTMLElement>} The confirmation dialog.
   */
  const openDeleteConfirmation = async () => {
    await screen.findByText('Failed uploads');
    fireEvent.click(screen.getByTestId('custom-menu-icon-Actions'));
    fireEvent.click(await screen.findByTestId('custom-menu-icon-item-Deletetagrule'));
    return screen.findByTestId('yes-no-dialog');
  };

  it('lists each rule with its tag and state, and says when rules tag tickets', async () => {
    renderPage();

    expect(await screen.findByText('Failed uploads')).toBeVisible();
    expect(screen.getByText('Urgent')).toBeVisible();
    expect(screen.getByText('Enabled')).toBeVisible();
    expect(screen.getByText(/new rules don't apply to existing tickets/)).toBeVisible();
  });

  it('deletes a rule and keeps its tags unless asked to remove them', async () => {
    renderPage();
    const confirmation = await openDeleteConfirmation();

    fireEvent.click(within(confirmation).getByTestId('yes-button'));

    await waitFor(() => expect(deleteTagRule).toHaveBeenCalledWith(tagRule.tag_rule_id, false));
  });

  it('deletes a rule and the tags it applied when the checkbox is checked', async () => {
    renderPage();
    const confirmation = await openDeleteConfirmation();

    fireEvent.click(within(confirmation).getByLabelText('Also remove the tags this rule applied'));
    fireEvent.click(within(confirmation).getByTestId('yes-button'));

    await waitFor(() => expect(deleteTagRule).toHaveBeenCalledWith(tagRule.tag_rule_id, true));
    expect(screen.queryByTestId('yes-no-dialog')).toBeNull();
  });

  it('does not delete a rule when the confirmation is cancelled', async () => {
    renderPage();
    const confirmation = await openDeleteConfirmation();

    fireEvent.click(within(confirmation).getByTestId('no-button'));

    await waitFor(() => expect(screen.queryByTestId('yes-no-dialog')).toBeNull());
    expect(deleteTagRule).not.toHaveBeenCalled();
  });
});
