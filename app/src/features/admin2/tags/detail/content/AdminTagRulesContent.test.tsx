import userEvent from '@testing-library/user-event';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ITagRule, ITagRuleDetail } from 'interfaces/useTagRulesApi.interface';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { AdminTagRulesContent } from './AdminTagRulesContent';

const expression = vi.hoisted(
  (): ExpressionTreeExpression => ({
    type: 'expression',
    operator: 'AND',
    clauses: [
      { type: 'predicate', feature_property_id: 4, blueprint_feature_type_property_id: null, operator: 'Exists' }
    ]
  })
);

vi.mock('components/expression-builder/PolicyExpressionBuilder', () => ({
  PolicyExpressionBuilder: ({
    value,
    onChange,
    onValidationChange
  }: {
    value?: ExpressionTreeExpression;
    onChange?: (value: ExpressionTreeExpression | null) => void;
    onValidationChange?: (error: string | null) => void;
  }) => (
    <div data-testid="policy-expression">
      {value ? 'Expression loaded' : 'No expression'}
      <button
        type="button"
        onClick={() => {
          onChange?.(expression);
          onValidationChange?.(null);
        }}>
        Set expression
      </button>
      <button type="button" onClick={() => onValidationChange?.('Invalid expression')}>
        Set invalid expression
      </button>
    </div>
  )
}));
vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));
vi.mock('hooks/useContext', () => ({ useDialogContext: vi.fn() }));

const tagId = '11111111-1111-4111-8111-111111111111';

const tagRule: ITagRule = {
  tag_rule_id: '22222222-2222-4222-8222-222222222222',
  tag_id: tagId,
  name: 'Moose surveys',
  description: 'Uploads and requests about moose',
  is_enabled: true,
  expression_id: '33333333-3333-4333-8333-333333333333',
  create_date: '2026-10-01T00:00:00.000Z'
};

const tagRuleDetail: ITagRuleDetail = { ...tagRule, expression };

describe('AdminTagRulesContent', () => {
  const getTagRules = vi.fn();
  const getTagRule = vi.fn();
  const createTagRule = vi.fn();
  const updateTagRule = vi.fn();
  const updateTagRuleEnabled = vi.fn();
  const deleteTagRule = vi.fn();
  const setSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getTagRules.mockResolvedValue({
      tag_rules: [tagRule],
      pagination: { total: 11, current_page: 1, last_page: 2, per_page: 10 }
    });
    getTagRule.mockResolvedValue(tagRuleDetail);
    createTagRule.mockResolvedValue(tagRuleDetail);
    updateTagRule.mockResolvedValue(tagRuleDetail);
    deleteTagRule.mockResolvedValue(undefined);
    (useApi as Mock).mockReturnValue({
      tagRules: { getTagRules, getTagRule, createTagRule, updateTagRule, updateTagRuleEnabled, deleteTagRule }
    });
    (useDialogContext as Mock).mockReturnValue({ setSnackbar });
  });

  /**
   * Renders the tag's Rules tab.
   *
   * @returns The RTL render result.
   */
  const renderContent = () =>
    render(
      <MemoryRouter>
        <AdminTagRulesContent tagId={tagId} />
      </MemoryRouter>
    );

  /**
   * Opens the actions menu of the only listed rule and clicks one of its items.
   *
   * @param {string} menuLabel The item's label without spaces, as its test id carries it.
   * @returns {Promise<void>}
   */
  const clickRowAction = async (menuLabel: string) => {
    await screen.findByText('Moose surveys');
    fireEvent.click(screen.getByTestId('custom-menu-icon-Actions'));
    fireEvent.click(await screen.findByTestId(`custom-menu-icon-item-${menuLabel}`));
  };

  it("lists one page of the tag's rules with their state and the server total, and says when rules tag tickets", async () => {
    renderContent();

    expect(await screen.findByText('Moose surveys')).toBeVisible();
    expect(screen.getByText('Uploads and requests about moose')).toBeVisible();
    expect(screen.getByText('Enabled')).toBeVisible();
    expect(screen.getByText('(11)')).toBeVisible();
    expect(screen.getByText(/don't apply to existing tickets/)).toBeVisible();
    expect(getTagRules).toHaveBeenCalledWith(
      tagId,
      { page: 1, limit: 10, sort: 'name', order: 'asc' },
      { signal: expect.any(AbortSignal) }
    );
  });

  it('requires a name and an expression to create a rule', async () => {
    const user = userEvent.setup();
    renderContent();
    await screen.findByText('Moose surveys');

    await user.click(screen.getByTestId('tag-rules-add-button'));
    await user.click(screen.getByTestId('edit-dialog-save-button'));

    expect(await screen.findByText('Name is required')).toBeVisible();
    expect(screen.getByText('A complete expression is required')).toBeVisible();
    expect(createTagRule).not.toHaveBeenCalled();
  });

  it('does not create a rule while the expression draft is invalid', async () => {
    const user = userEvent.setup();
    renderContent();
    await screen.findByText('Moose surveys');

    await user.click(screen.getByTestId('tag-rules-add-button'));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Moose surveys' } });
    await user.click(screen.getByText('Set expression'));
    await user.click(screen.getByText('Set invalid expression'));
    await user.click(screen.getByTestId('edit-dialog-save-button'));

    expect(await screen.findByText('A complete expression is required')).toBeVisible();
    expect(createTagRule).not.toHaveBeenCalled();
  });

  it("creates a rule with its name, description and expression on the tag's rules", async () => {
    const user = userEvent.setup();
    renderContent();
    await screen.findByText('Moose surveys');

    await user.click(screen.getByTestId('tag-rules-add-button'));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: '  Moose surveys ' } });
    await user.click(screen.getByText('Set expression'));
    await user.click(screen.getByTestId('edit-dialog-save-button'));

    await waitFor(() =>
      expect(createTagRule).toHaveBeenCalledWith(tagId, { name: 'Moose surveys', description: null, expression })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Created rule Moose surveys' });
  });

  it("keeps the dialog open with the server's error when the name is taken", async () => {
    createTagRule.mockRejectedValue(new Error('A tag rule with this name already exists'));
    const user = userEvent.setup();
    renderContent();
    await screen.findByText('Moose surveys');

    await user.click(screen.getByTestId('tag-rules-add-button'));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Moose surveys' } });
    await user.click(screen.getByText('Set expression'));
    await user.click(screen.getByTestId('edit-dialog-save-button'));

    expect(await screen.findByText('A tag rule with this name already exists')).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it("loads a rule's expression to edit it and saves it unchanged", async () => {
    const user = userEvent.setup();
    renderContent();

    await clickRowAction('Editrule');

    expect(await screen.findByDisplayValue('Moose surveys')).toBeVisible();
    expect(getTagRule).toHaveBeenCalledWith(tagId, tagRule.tag_rule_id, { signal: expect.any(AbortSignal) });
    expect(screen.getByText('Expression loaded')).toBeVisible();

    await user.click(screen.getByTestId('edit-dialog-save-button'));

    await waitFor(() =>
      expect(updateTagRule).toHaveBeenCalledWith(tagId, tagRule.tag_rule_id, {
        name: 'Moose surveys',
        description: 'Uploads and requests about moose',
        expression
      })
    );
  });

  it('disables a rule at once and keeps it disabled once saved', async () => {
    updateTagRuleEnabled.mockResolvedValue({ ...tagRule, is_enabled: false });
    renderContent();

    await clickRowAction('Disablerule');

    expect(await screen.findByText('Disabled')).toBeVisible();
    await waitFor(() =>
      expect(updateTagRuleEnabled).toHaveBeenCalledWith(tagId, tagRule.tag_rule_id, { isEnabled: false })
    );
    // The saved row is kept rather than reloading the page.
    expect(getTagRules).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Disabled')).toBeVisible();
  });

  it('restores the rule and reports the error when disabling fails', async () => {
    let rejectUpdate: (error: Error) => void = () => {};
    updateTagRuleEnabled.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectUpdate = reject;
      })
    );
    renderContent();

    await clickRowAction('Disablerule');

    expect(await screen.findByText('Disabled')).toBeVisible();

    await act(async () => rejectUpdate(new Error('Failed to disable')));

    expect(await screen.findByText('Enabled')).toBeVisible();
    expect(setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Failed to disable' });
  });

  it('deletes a rule and keeps the tags it applied unless asked to remove them', async () => {
    renderContent();
    await clickRowAction('Deleterule');

    const confirmation = await screen.findByTestId('yes-no-dialog');
    fireEvent.click(within(confirmation).getByTestId('yes-button'));

    await waitFor(() => expect(deleteTagRule).toHaveBeenCalledWith(tagId, tagRule.tag_rule_id, false));
  });

  it('deletes a rule and the tags it applied when the checkbox is checked', async () => {
    renderContent();
    await clickRowAction('Deleterule');

    const confirmation = await screen.findByTestId('yes-no-dialog');
    fireEvent.click(within(confirmation).getByLabelText('Also remove the tags this rule applied'));
    fireEvent.click(within(confirmation).getByTestId('yes-button'));

    await waitFor(() => expect(deleteTagRule).toHaveBeenCalledWith(tagId, tagRule.tag_rule_id, true));
  });

  it('does not delete a rule when the confirmation is cancelled', async () => {
    renderContent();
    await clickRowAction('Deleterule');

    const confirmation = await screen.findByTestId('yes-no-dialog');
    fireEvent.click(within(confirmation).getByTestId('no-button'));

    await waitFor(() => expect(screen.queryByTestId('yes-no-dialog')).toBeNull());
    expect(deleteTagRule).not.toHaveBeenCalled();
  });
});
