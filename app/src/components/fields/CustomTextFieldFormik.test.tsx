import { Formik, FormikValues, useFormikContext } from 'formik';
import { render } from 'test-helpers/test-utils';
import CustomTextFieldFormik from './CustomTextFieldFormik';

const FormikValueProbe = () => {
  const { values } = useFormikContext<FormikValues>();

  return <div data-testid="formik-probe">{String(values.testField ?? '')}</div>;
};

describe('CustomTextFieldFormik', () => {
  it('binds initial value from formik', () => {
    const { getByDisplayValue } = render(
      <Formik initialValues={{ testField: 'initial value' }} onSubmit={async () => {}}>
        <>
          <CustomTextFieldFormik name="testField" label="Test Field" />
          <FormikValueProbe />
        </>
      </Formik>
    );

    expect(getByDisplayValue('initial value')).toBeVisible();
  });
});
