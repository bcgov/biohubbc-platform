import { Formik } from 'formik';
import { render } from 'test-helpers/test-utils';
import BCeIDRequestForm, { BCeIDRequestFormInitialValues, BCeIDRequestFormYupSchema } from './BCeIDRequestForm';

describe('BCeIDRequestForm', () => {
  it('renders properly', () => {
    const { getAllByText } = render(
      <Formik
        initialValues={BCeIDRequestFormInitialValues}
        validationSchema={BCeIDRequestFormYupSchema}
        onSubmit={async () => {}}
      >
        {() => <BCeIDRequestForm />}
      </Formik>
    );

    expect(getAllByText('Company Name').length).toEqual(2);
  });
});
