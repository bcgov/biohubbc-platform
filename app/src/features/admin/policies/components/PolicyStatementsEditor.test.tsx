import { Formik } from 'formik';
import { IAddPolicyFormValues } from 'interfaces/usePoliciesApi.interface';
import { cleanup, fireEvent, render, waitFor } from 'test-helpers/test-utils';
import PolicyStatementsEditor from './PolicyStatementsEditor';

const renderContainer = (initialValues: IAddPolicyFormValues) => {
  return render(
    <Formik initialValues={initialValues} onSubmit={vi.fn()}>
      <PolicyStatementsEditor />
    </Formik>
  );
};

describe('PolicyStatementsEditor', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the add statement button', async () => {
    const { getByText } = renderContainer({
      name: '',
      description: '',
      statements: []
    });

    await waitFor(() => {
      expect(getByText('Add Statement')).toBeVisible();
    });
  });

  it('renders existing statements', async () => {
    const { getByText, getByDisplayValue } = renderContainer({
      name: '',
      description: '',
      statements: [{ _key: 'test-key-1', effect: 'allow', submission_feature_urn: 'urn:*:*:*' }]
    });

    await waitFor(() => {
      expect(getByText('Statement 1')).toBeVisible();
      expect(getByDisplayValue('urn:*:*:*')).toBeVisible();
    });
  });

  it('adds a new statement when button is clicked', async () => {
    const { getByText, queryByText } = renderContainer({
      name: '',
      description: '',
      statements: []
    });

    expect(queryByText('Statement 1')).not.toBeInTheDocument();

    fireEvent.click(getByText('Add Statement'));

    await waitFor(() => {
      expect(getByText('Statement 1')).toBeVisible();
    });
  });

  it('renders multiple statements', async () => {
    const { getByText } = renderContainer({
      name: '',
      description: '',
      statements: [
        { _key: 'test-key-1', effect: 'allow', submission_feature_urn: 'urn:*:*:*' },
        { _key: 'test-key-2', effect: 'deny', submission_feature_urn: 'urn:1:telemetry:*' }
      ]
    });

    await waitFor(() => {
      expect(getByText('Statement 1')).toBeVisible();
      expect(getByText('Statement 2')).toBeVisible();
    });
  });
});
