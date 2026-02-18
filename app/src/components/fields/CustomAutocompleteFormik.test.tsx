import { fireEvent, waitFor } from '@testing-library/react';
import { Formik, FormikValues, useFormikContext } from 'formik';
import { render } from 'test-helpers/test-utils';
import CustomAutocompleteFormik from './CustomAutocompleteFormik';

const FormikValueProbe = () => {
  const { values } = useFormikContext<FormikValues>();

  return <div data-testid="formik-probe">{String(values.status ?? '')}</div>;
};

describe('CustomAutocompleteFormik', () => {
  const options = [
    { value: 'OPEN', label: 'Open' },
    { value: 'CLOSED', label: 'Closed' }
  ];

  it('maps primitive form value to selected option label', () => {
    const { getByDisplayValue } = render(
      <Formik initialValues={{ status: 'OPEN' }} onSubmit={async () => {}}>
        <CustomAutocompleteFormik id="status" name="status" label="Status" options={options} />
      </Formik>
    );

    expect(getByDisplayValue('Open')).toBeVisible();
  });

  it('updates primitive form value on selection', async () => {
    const { getByLabelText, getByText, getByTestId } = render(
      <Formik initialValues={{ status: '' }} onSubmit={async () => {}}>
        <>
          <CustomAutocompleteFormik id="status" name="status" label="Status" options={options} />
          <FormikValueProbe />
        </>
      </Formik>
    );

    const input = getByLabelText('Status');

    fireEvent.mouseDown(input);
    fireEvent.click(getByText('Closed'));

    await waitFor(() => {
      expect(getByTestId('formik-probe')).toHaveTextContent('CLOSED');
    });
  });
});
