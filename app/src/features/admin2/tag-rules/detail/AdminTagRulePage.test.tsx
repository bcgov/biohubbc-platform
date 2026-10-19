import userEvent from '@testing-library/user-event';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ITagRuleDetail } from 'interfaces/useTagRulesApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { AdminTagRulePage } from './AdminTagRulePage';

const expression: ExpressionTreeExpression = {
  type: 'expression',
  operator: 'AND',
  clauses: [{ type: 'predicate', feature_property_id: 4, blueprint_feature_type_property_id: null, operator: 'Exists' }]
};

vi.mock('components/expression-builder/PolicyExpressionBuilder', () => ({
  PolicyExpressionBuilder: (props: { onChange: (value: ExpressionTreeExpression) => void }) => (
    <button type="button" data-testid="policy-expression" onClick={() => props.onChange(expression)}>
      Build expression
    </button>
  )
}));
vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));
vi.mock('hooks/useContext', () => ({ useDialogContext: vi.fn() }));

const tagId = '22222222-2222-4222-8222-222222222222';
const tagRule: ITagRuleDetail = {
  tag_rule_id: '11111111-1111-4111-8111-111111111111',
  tag_id: tagId,
  tag_name: 'Urgent',
  tag_color: '#D8292F',
  name: 'Moose surveys',
  description: 'Uploads and requests about moose',
  is_enabled: false,
  expression_id: '33333333-3333-4333-8333-333333333333',
  create_date: '2026-10-01T00:00:00.000Z',
  expression
};

describe('AdminTagRulePage', () => {
  const getTagRule = vi.fn();
  const createTagRule = vi.fn();
  const updateTagRule = vi.fn();
  const getTags = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getTagRule.mockResolvedValue(tagRule);
    createTagRule.mockResolvedValue(tagRule);
    updateTagRule.mockResolvedValue(tagRule);
    getTags.mockResolvedValue({
      tags: [{ tag_id: tagId, name: 'Urgent', description: null, color: '#D8292F', create_date: '' }]
    });
    (useApi as Mock).mockReturnValue({
      tagRules: { getTagRule, createTagRule, updateTagRule },
      tags: { getTags }
    });
    (useDialogContext as Mock).mockReturnValue({ setSnackbar: vi.fn() });
  });

  /**
   * Renders the tag rule page at the given route.
   *
   * @param {string} path `/admin/tag-rules/new` or a rule's route.
   * @returns The RTL render result.
   */
  const renderPage = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/tag-rules/new" element={<AdminTagRulePage />} />
          <Route path="/admin/tag-rules/:tagRuleId" element={<AdminTagRulePage />} />
          <Route path="/admin/tag-rules" element={<div data-testid="tag-rules-list" />} />
        </Routes>
      </MemoryRouter>
    );

  /**
   * Fills the new rule's tag and name.
   *
   * @returns {Promise<void>}
   */
  const fillRuleDetails = async () => {
    await userEvent.click(screen.getByRole('combobox', { name: 'Tag' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Urgent' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: '  Moose surveys ' } });
  };

  it('creates a rule with its tag, details and expression', async () => {
    renderPage('/admin/tag-rules/new');
    await fillRuleDetails();

    await userEvent.click(screen.getByTestId('policy-expression'));
    await userEvent.click(screen.getAllByRole('button', { name: 'Create' })[0]);

    await waitFor(() =>
      expect(createTagRule).toHaveBeenCalledWith({
        tagId,
        name: 'Moose surveys',
        description: null,
        isEnabled: true,
        expression
      })
    );
    expect(createTagRule.mock.calls[0][0]).not.toHaveProperty('criteria');
    expect(await screen.findByTestId('tag-rules-list')).toBeInTheDocument();
  });

  it('requires an expression', async () => {
    renderPage('/admin/tag-rules/new');
    await fillRuleDetails();

    await userEvent.click(screen.getAllByRole('button', { name: 'Create' })[0]);

    expect(await screen.findByText('Expression is required')).toBeVisible();
    expect(createTagRule).not.toHaveBeenCalled();
  });

  it('loads a rule and saves it unchanged', async () => {
    renderPage(`/admin/tag-rules/${tagRule.tag_rule_id}`);

    expect(await screen.findByDisplayValue('Moose surveys')).toBeVisible();

    await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() =>
      expect(updateTagRule).toHaveBeenCalledWith(tagRule.tag_rule_id, {
        tagId,
        name: 'Moose surveys',
        description: 'Uploads and requests about moose',
        isEnabled: false,
        expression
      })
    );
  });

  it('keeps the form and shows the error when the name is taken', async () => {
    updateTagRule.mockRejectedValue(new Error('A tag rule with this name already exists'));
    renderPage(`/admin/tag-rules/${tagRule.tag_rule_id}`);
    await screen.findByDisplayValue('Moose surveys');

    await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    expect(await screen.findByText('A tag rule with this name already exists')).toBeVisible();
    expect(screen.queryByTestId('tag-rules-list')).toBeNull();
  });
});
