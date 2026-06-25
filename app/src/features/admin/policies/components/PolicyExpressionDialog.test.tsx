import userEvent from '@testing-library/user-event';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { cleanup, fireEvent, render, waitFor } from 'test-helpers/test-utils';
import { PolicyExpressionDialog } from './PolicyExpressionDialog';

const mockExpression = vi.hoisted(
  (): ExpressionTreeExpression => ({
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 1,
        feature_type_property_id: null,
        operator: 'Equals',
        value: 'north'
      }
    ]
  })
);

vi.mock('components/expression-builder/PolicyExpressionBuilder', () => ({
  PolicyExpressionBuilder: ({
    onChange,
    onValidationChange
  }: {
    onChange?: (value: ExpressionTreeExpression | null) => void;
    onValidationChange?: (error: string | null) => void;
  }) => (
    <div data-testid="policy-expression">
      <button
        type="button"
        onClick={() => {
          onChange?.(mockExpression);
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

const renderDialog = (onSave = vi.fn()) => {
  const result = render(
    <PolicyExpressionDialog open={true} isLoading={false} mode="create" onCancel={vi.fn()} onSave={onSave} />
  );

  return {
    ...result,
    onSave
  };
};

describe('PolicyExpressionDialog', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the policy expression form fields', () => {
    const { getByRole, getByLabelText, getByTestId } = renderDialog();

    expect(getByRole('heading', { name: 'Create Expression' })).toBeVisible();
    expect(getByLabelText('Name *')).toBeVisible();
    expect(getByLabelText('Description')).toBeVisible();
    expect(getByTestId('policy-expression')).toBeVisible();
  });

  it('requires a name', async () => {
    const user = userEvent.setup();
    const { getByTestId, findByText, onSave } = renderDialog();

    await user.click(getByTestId('edit-dialog-save-button'));

    expect(await findByText('Name is required')).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('requires an expression', async () => {
    const user = userEvent.setup();
    const { getByLabelText, getByTestId, queryByText, onSave } = renderDialog();

    fireEvent.change(getByLabelText('Name *'), { target: { value: 'Sensitive species' } });
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
    expect(queryByText('Expression is required')).not.toBeInTheDocument();
  });

  it('blocks save when the expression builder reports a validation error', async () => {
    const user = userEvent.setup();
    const { getByLabelText, getByText, getByTestId, onSave } = renderDialog();

    fireEvent.change(getByLabelText('Name *'), { target: { value: 'Sensitive species' } });
    await user.click(getByText('Set expression'));
    await user.click(getByText('Set invalid expression'));
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('submits valid policy expression values', async () => {
    const user = userEvent.setup();
    const { getByLabelText, getByText, getByTestId, onSave } = renderDialog();

    fireEvent.change(getByLabelText('Name *'), { target: { value: 'Sensitive species' } });
    fireEvent.change(getByLabelText('Description'), {
      target: { value: 'Filters sensitive species observations' }
    });
    await user.click(getByText('Set expression'));
    await user.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: 'Sensitive species',
        description: 'Filters sensitive species observations',
        expression: mockExpression,
        expression_error: undefined
      });
    });
  });
});
