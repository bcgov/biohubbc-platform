import { fireEvent, waitFor } from '@testing-library/react';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { Formik } from 'formik';
import { cleanup, render } from 'test-helpers/test-utils';
import { AddPolicyForm, AddPolicyFormInitialValues, IAddPolicyFormValues } from './AddPolicyForm';

// Mock Monaco Editor - it doesn't work well in jsdom and causes hangs
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value?: string) => void }) => (
    <textarea data-testid="monaco-editor" value={value || ''} onChange={(e) => onChange?.(e.target.value)} />
  ),
  loader: {
    init: vi.fn().mockResolvedValue({
      languages: {
        json: {
          jsonDefaults: {
            setDiagnosticsOptions: vi.fn()
          }
        }
      }
    })
  }
}));

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
      status: PolicyStatus.REVIEWED,
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
