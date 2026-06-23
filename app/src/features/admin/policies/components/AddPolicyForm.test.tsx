import { fireEvent, waitFor } from '@testing-library/react';
import { Formik } from 'formik';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { cleanup, render } from 'test-helpers/test-utils';
import { AddPolicyForm, AddPolicyFormInitialValues, IAddPolicyFormValues } from './AddPolicyForm';

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
    value,
    onChange
  }: {
    value?: ExpressionTreeExpression;
    onChange?: (value: ExpressionTreeExpression | null) => void;
  }) => (
    <div data-testid="policy-expression" data-has-expression={value ? 'true' : 'false'}>
      <button type="button" onClick={() => onChange?.(mockExpression)}>
        Change Expression
      </button>
    </div>
  )
}));

const renderContainer = (initialValues: IAddPolicyFormValues = AddPolicyFormInitialValues, onSubmit = vi.fn()) => {
  const result = render(
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      <AddPolicyForm />
    </Formik>
  );

  return {
    ...result,
    onSubmit
  };
};

describe('AddPolicyForm', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the policy name field', async () => {
    const { getByLabelText } = renderContainer();

    await waitFor(() => {
      expect(getByLabelText(/Policy Name/i)).toBeVisible();
    });
  });

  it('renders the description field', async () => {
    const { getByLabelText } = renderContainer();

    await waitFor(() => {
      expect(getByLabelText(/Description/i)).toBeVisible();
    });
  });

  it('renders the statement and expression fields', async () => {
    const { getByLabelText, getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByLabelText(/Status/i)).toBeVisible();
      expect(getByLabelText(/Effect/i)).toBeVisible();
      expect(getByLabelText(/Resource/i)).toBeVisible();
      expect(getByTestId('policy-expression')).toBeVisible();
    });
  });

  it('renders with pre-populated values', async () => {
    const { getByDisplayValue, getByTestId } = renderContainer({
      name: 'Test Policy',
      description: 'Test description',
      status: PolicyStatus.REVIEWED,
      statement_effect: 'deny',
      submission_feature_urn: 'urn:1:telemetry:*',
      expression: mockExpression
    });

    await waitFor(() => {
      expect(getByDisplayValue('Test Policy')).toBeVisible();
      expect(getByDisplayValue('Test description')).toBeVisible();
      expect(getByDisplayValue('urn:1:telemetry:*')).toBeVisible();
      expect(getByTestId('policy-expression')).toHaveAttribute('data-has-expression', 'true');
    });
  });

  it('allows user to enter policy name', async () => {
    const { getByLabelText, getByDisplayValue } = renderContainer();

    fireEvent.change(getByLabelText(/Policy Name/i), { target: { value: 'New Policy' } });

    await waitFor(() => {
      expect(getByDisplayValue('New Policy')).toBeVisible();
    });
  });

  it('commits the applied expression into form values', async () => {
    const { container, getByText, onSubmit } = renderContainer({
      ...AddPolicyFormInitialValues,
      name: 'Expression Policy'
    });

    fireEvent.click(getByText('Change Expression'));
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          expression: mockExpression
        }),
        expect.anything()
      );
    });
  });
});
