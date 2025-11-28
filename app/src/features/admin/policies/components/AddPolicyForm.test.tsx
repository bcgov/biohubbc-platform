import { fireEvent, waitFor } from '@testing-library/react';
import { Formik } from 'formik';
import { IAddPolicyFormValues } from 'interfaces/usePoliciesApi.interface';
import { cleanup, render } from 'test-helpers/test-utils';
import AddPolicyForm, { AddPolicyFormInitialValues } from './AddPolicyForm';

const renderContainer = (initialValues: IAddPolicyFormValues = AddPolicyFormInitialValues) => {
  return render(
    <Formik initialValues={initialValues} onSubmit={vi.fn()}>
      <AddPolicyForm />
    </Formik>
  );
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

  it('renders the PolicyStatementsEditor', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('Policy Statements')).toBeVisible();
      expect(getByText('Add Statement')).toBeVisible();
    });
  });

  it('renders with pre-populated values', async () => {
    const { getByDisplayValue } = renderContainer({
      name: 'Test Policy',
      description: 'Test description',
      statements: []
    });

    await waitFor(() => {
      expect(getByDisplayValue('Test Policy')).toBeVisible();
      expect(getByDisplayValue('Test description')).toBeVisible();
    });
  });

  it('allows user to enter policy name', async () => {
    const { getByLabelText, getByDisplayValue } = renderContainer();

    fireEvent.change(getByLabelText(/Policy Name/i), { target: { value: 'New Policy' } });

    await waitFor(() => {
      expect(getByDisplayValue('New Policy')).toBeVisible();
    });
  });
});
