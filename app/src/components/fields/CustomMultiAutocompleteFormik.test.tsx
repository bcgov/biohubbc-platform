import { Formik } from 'formik';
import { render } from 'test-helpers/test-utils';
import { sortAutocompleteOptions } from 'utils/autocomplete';
import CustomMultiAutocompleteFormik from './CustomMultiAutocompleteFormik';
import { ICustomMultiAutocompleteOption } from './CustomMultiAutocomplete';

describe('CustomMultiAutocompleteFormik', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <Formik initialValues={{ categories: [] }} onSubmit={async () => {}}>
        <CustomMultiAutocompleteFormik
          id="categories"
          name="categories"
          label="Categories"
          options={[{ value: 'val', label: 'label' }]}
          required={true}
          filterLimit={1}
        />
      </Formik>
    );

    expect(getByText('Categories')).toBeVisible();
  });

  describe('sortAutocompleteOptions', () => {
    it('retains selected options if no remaining options are given', () => {
      const selected: ICustomMultiAutocompleteOption[] = [
        { value: 'value1', label: 'Value_1' },
        { value: 'value2', label: 'Value_2' },
        { value: 'value3', label: 'Value_3' }
      ];

      const sorted = sortAutocompleteOptions(selected, []);
      expect(sorted.length).toEqual(3);
    });

    it('combines selected and given options in sorted order', () => {
      const selected: ICustomMultiAutocompleteOption[] = [
        { value: 'value1', label: 'Value_1' },
        { value: 'value2', label: 'Value_2' },
        { value: 'value3', label: 'Value_3' }
      ];

      const optionsLeft: ICustomMultiAutocompleteOption[] = [
        { value: 'value4', label: 'Value_4' },
        { value: 'value5', label: 'Value_5' }
      ];

      const sorted = sortAutocompleteOptions(selected, optionsLeft);
      expect(sorted.length).toEqual(5);
      expect(sorted[0].value).toEqual('value1');
    });

    it('removes duplicate options from selected and given options', () => {
      const selected: ICustomMultiAutocompleteOption[] = [
        { value: 'value1', label: 'Value_1' },
        { value: 'value2', label: 'Value_2' },
        { value: 'value3', label: 'Value_3' }
      ];

      const optionsLeft: ICustomMultiAutocompleteOption[] = [
        { value: 'value2', label: 'Value_2' },
        { value: 'value3', label: 'Value_3' },
        { value: 'value4', label: 'Value_4' }
      ];

      const sorted = sortAutocompleteOptions(selected, optionsLeft);
      expect(sorted.length).toEqual(4);
    });

    it('returns all given options if none are selected', () => {
      const optionsLeft: ICustomMultiAutocompleteOption[] = [
        { value: 'value2', label: 'Value_2' },
        { value: 'value3', label: 'Value_3' },
        { value: 'value4', label: 'Value_4' }
      ];

      const sorted = sortAutocompleteOptions([], optionsLeft);
      expect(sorted.length).toEqual(3);
      expect(sorted[0].value).toEqual('value2');
    });
  });
});
