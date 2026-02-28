import { fireEvent, waitFor } from '@testing-library/react';
import EditDialog from 'components/dialog/EditDialog';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { useFormikContext } from 'formik';
import { render } from 'test-helpers/test-utils';
import yup from 'utils/YupSchema';

export interface ISampleFormikFormProps {
  testField: string;
}

export const SampleFormikFormYupSchema = yup.object().shape({
  testField: yup.string().max(3000, 'Cannot exceed 3000 characters').required('You must provide a test field')
});

const SampleFormikForm = () => {
  const formikProps = useFormikContext<ISampleFormikFormProps>();

  const { handleSubmit } = formikProps;

  return (
    <form onSubmit={handleSubmit}>
      <CustomTextFieldFormik name="testField" label="Test Field" multiline required rows={4} />
    </form>
  );
};

const handleOnSave = vi.fn();
const handleOnCancel = vi.fn();

const renderContainer = ({
  testFieldValue,
  dialogError,
  open,
  isLoading
}: {
  testFieldValue: string;
  dialogError?: string;
  open?: boolean;
  isLoading?: boolean;
}) => {
  return render(
    <div id="root">
      <EditDialog
        isLoading={isLoading}
        dialogTitle="This is dialog title"
        dialogError={dialogError || undefined}
        open={open ?? false}
        component={{
          element: <SampleFormikForm />,
          initialValues: { testField: testFieldValue },
          validationSchema: SampleFormikFormYupSchema
        }}
        onCancel={handleOnCancel}
        onSave={handleOnSave}
      />
    </div>
  );
};

describe('EditDialog', () => {
  it('renders component and data values', () => {
    const { getByTestId, getByText } = renderContainer({ testFieldValue: 'this is a test', open: true });

    expect(getByTestId('testField')).toBeVisible();
    expect(getByText('this is a test')).toBeVisible();
  });

  it('matches snapshot when open, with error message', () => {
    const { getByTestId, getByText } = renderContainer({
      testFieldValue: 'this is a test',
      dialogError: 'This is an error',
      open: true
    });

    expect(getByTestId('testField')).toBeVisible();
    expect(getByText('This is an error')).toBeVisible();
  });

  it('calls the onSave prop when `Save Changes` button is clicked', async () => {
    const { getByTestId, getByLabelText } = renderContainer({ testFieldValue: 'initial value', open: true });

    const textField = await getByLabelText('Test Field', { exact: false });

    fireEvent.change(textField, { target: { value: 'updated value' } });

    const saveChangesButton = getByTestId('edit-dialog-save-button');

    fireEvent.click(saveChangesButton);

    await waitFor(() => {
      expect(handleOnSave).toHaveBeenCalledTimes(1);
      expect(handleOnSave).toHaveBeenCalledWith({
        testField: 'updated value'
      });
    });
  });

  it('hides save label text while loading', () => {
    const { getByTestId, queryByText } = renderContainer({
      testFieldValue: 'this is a test',
      open: true,
      isLoading: true
    });

    expect(getByTestId('edit-dialog-save-button')).toBeVisible();
    expect(queryByText('Save Changes', { exact: false })).toBeNull();
  });

  it('calls the onCancel prop when `Cancel` button is clicked', async () => {
    const { findByText } = renderContainer({ testFieldValue: 'this is a test', open: true });

    const cancelButton = await findByText('Cancel', { exact: false });

    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(handleOnCancel).toHaveBeenCalledTimes(1);
    });
  });
});
