import { render } from 'test-helpers/test-utils';
import { Formik } from 'formik';
import MultiAutocompleteField from './MultiAutocompleteField';

describe('MultiAutocompleteField', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <Formik initialValues={[]} onSubmit={async () => {}}>
        {() => (
          <MultiAutocompleteField
            id="id"
            label="label"
            options={[{ value: 'val', label: 'label' }]}
            required={true}
            filterLimit={1}
          />
        )}
      </Formik>
    );

    expect(getByText("label")).toBeVisible();
  });
});
