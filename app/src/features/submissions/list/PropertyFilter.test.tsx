import { fireEvent, waitFor } from '@testing-library/react';
import { FeaturePropertyCode } from 'interfaces/useCodesApi.interface';
import { IPropertyFilter } from 'interfaces/useSearchApi.interface';
import { render } from 'test-helpers/test-utils';
import PropertyFilter from './PropertyFilter';

const mockOnChange = vi.fn();
const mockOnRemove = vi.fn();

const mockProperties: FeaturePropertyCode[] = [
  {
    feature_property_id: 1,
    feature_property_name: 'scientific_name',
    feature_property_display_name: 'Scientific Name',
    feature_property_type_id: 1,
    feature_property_type_name: 'string'
  },
  {
    feature_property_id: 2,
    feature_property_name: 'description',
    feature_property_display_name: 'Description',
    feature_property_type_id: 1,
    feature_property_type_name: 'string'
  },
  {
    feature_property_id: 3,
    feature_property_name: 'taxon_id',
    feature_property_display_name: 'Taxonomic Identifier',
    feature_property_type_id: 2,
    feature_property_type_name: 'number'
  }
];

const renderComponent = (filter: IPropertyFilter, availableProperties = mockProperties) =>
  render(
    <PropertyFilter
      filter={filter}
      availableProperties={availableProperties}
      onChange={mockOnChange}
      onRemove={mockOnRemove}
    />
  );

describe('PropertyFilter', () => {
  beforeEach(() => {
    mockOnChange.mockClear();
    mockOnRemove.mockClear();
  });

  describe('Rendering', () => {
    it('should render property dropdown and value input', async () => {
      const { getByLabelText, getByPlaceholderText } = renderComponent({
        featureTypeName: 'animal',
        propertyName: '',
        propertyType: 'string',
        value: ''
      });

      await waitFor(() => {
        expect(getByLabelText('Property')).toBeVisible();
        expect(getByPlaceholderText('Enter value')).toBeVisible();
      });
    });

    it('should render remove button', async () => {
      const { getByRole } = renderComponent({
        featureTypeName: 'animal',
        propertyName: '',
        propertyType: 'string',
        value: ''
      });

      await waitFor(() => {
        expect(getByRole('button', { name: /remove filter/i })).toBeVisible();
      });
    });

    it('should display selected property', async () => {
      const { getByDisplayValue } = renderComponent({
        featureTypeName: 'animal',
        propertyName: 'scientific_name',
        propertyType: 'string',
        value: ''
      });

      await waitFor(() => {
        expect(getByDisplayValue('Scientific Name')).toBeVisible();
      });
    });

    it('should display filter value', async () => {
      const { getByDisplayValue } = renderComponent({
        featureTypeName: 'animal',
        propertyName: '',
        propertyType: 'string',
        value: 'Moose'
      });

      await waitFor(() => {
        expect(getByDisplayValue('Moose')).toBeVisible();
      });
    });
  });

  describe('Interactions', () => {
    it('should call onChange when value is entered', async () => {
      const { getByPlaceholderText } = renderComponent({
        featureTypeName: 'animal',
        propertyName: 'scientific_name',
        propertyType: 'string',
        value: ''
      });

      const valueInput = getByPlaceholderText('Enter value');
      fireEvent.change(valueInput, { target: { value: 'Alces alces' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        featureTypeName: 'animal',
        propertyName: 'scientific_name',
        propertyType: 'string',
        value: 'Alces alces'
      });
    });

    it('should call onRemove when remove button clicked', async () => {
      const { getByRole } = renderComponent({
        featureTypeName: 'animal',
        propertyName: '',
        propertyType: 'string',
        value: ''
      });

      const removeBtn = getByRole('button', { name: /remove filter/i });
      fireEvent.click(removeBtn);

      expect(mockOnRemove).toHaveBeenCalled();
    });

    it('should call onChange when property is selected', async () => {
      const { getByLabelText, getByText } = renderComponent({
        featureTypeName: 'animal',
        propertyName: '',
        propertyType: 'string',
        value: 'test'
      });

      // Open the autocomplete dropdown
      const autocomplete = getByLabelText('Property');
      fireEvent.mouseDown(autocomplete);

      // Select an option
      await waitFor(() => {
        const option = getByText('Description');
        fireEvent.click(option);
      });

      expect(mockOnChange).toHaveBeenCalledWith({
        featureTypeName: 'animal',
        propertyName: 'description',
        propertyType: 'string',
        value: 'test'
      });
    });
  });
});
