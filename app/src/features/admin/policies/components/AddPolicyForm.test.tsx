import { fireEvent, waitFor } from '@testing-library/react';
import { Formik } from 'formik';
import { cleanup, render } from 'test-helpers/test-utils';
import AddPolicyForm, { AddPolicyFormInitialValues, IAddPolicyFormValues } from './AddPolicyForm';

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

  it('renders the Policy Document section', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('Policy Document')).toBeVisible();
    });
  });

  it('renders with pre-populated values', async () => {
    const { getByDisplayValue } = renderContainer({
      name: 'Test Policy',
      description: 'Test description',
      policy_json: JSON.stringify({ Version: '2024-01-01', Statement: [] }, null, 2)
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
