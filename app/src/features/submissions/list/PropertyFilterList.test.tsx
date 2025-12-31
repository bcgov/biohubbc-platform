import { fireEvent, waitFor } from '@testing-library/react';
import { FeaturePropertyCode } from 'interfaces/useCodesApi.interface';
import { IPropertyFilter } from 'interfaces/useSearchApi.interface';
import { render } from 'test-helpers/test-utils';
import PropertyFilterList from './PropertyFilterList';

const mockOnChange = vi.fn();

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
  }
];

const renderComponent = (filters: IPropertyFilter[], availableProperties = mockProperties) =>
  render(<PropertyFilterList filters={filters} availableProperties={availableProperties} onChange={mockOnChange} />);

describe('PropertyFilterList', () => {
  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Rendering', () => {
    it('should render filter rows for each filter', async () => {
      const filters: IPropertyFilter[] = [
        { featureTypeName: 'animal', propertyName: 'scientific_name', propertyType: 'string', value: 'Moose' },
        { featureTypeName: 'animal', propertyName: 'description', propertyType: 'string', value: 'Wildlife' }
      ];
      const { getByDisplayValue } = renderComponent(filters);

      await waitFor(() => {
        expect(getByDisplayValue('Moose')).toBeVisible();
        expect(getByDisplayValue('Wildlife')).toBeVisible();
      });
    });

    it('should render nothing visible when no filters', async () => {
      const { container } = renderComponent([]);

      await waitFor(() => {
        // The Collapse component hides content when no filters
        expect(container.querySelector('.MuiCollapse-hidden')).toBeInTheDocument();
      });
    });
  });

  describe('Remove Filter', () => {
    it('should call onChange without removed filter', async () => {
      const filters: IPropertyFilter[] = [
        { featureTypeName: 'animal', propertyName: 'scientific_name', propertyType: 'string', value: 'test1' },
        { featureTypeName: 'animal', propertyName: 'description', propertyType: 'string', value: 'test2' }
      ];
      const { getAllByRole } = renderComponent(filters);

      // Click first remove button
      const removeButtons = getAllByRole('button', { name: /remove filter/i });
      fireEvent.click(removeButtons[0]);

      expect(mockOnChange).toHaveBeenCalledWith([
        { featureTypeName: 'animal', propertyName: 'description', propertyType: 'string', value: 'test2' }
      ]);
    });

    it('should call onChange with empty array when last filter removed', async () => {
      const filters: IPropertyFilter[] = [
        { featureTypeName: 'animal', propertyName: 'scientific_name', propertyType: 'string', value: 'test' }
      ];
      const { getByRole } = renderComponent(filters);

      const removeBtn = getByRole('button', { name: /remove filter/i });
      fireEvent.click(removeBtn);

      expect(mockOnChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Update Filter', () => {
    it('should call onChange with updated filter value', async () => {
      const filters: IPropertyFilter[] = [
        { featureTypeName: 'animal', propertyName: 'scientific_name', propertyType: 'string', value: '' }
      ];
      const { getByPlaceholderText } = renderComponent(filters);

      const valueInput = getByPlaceholderText('Enter value');
      fireEvent.change(valueInput, { target: { value: 'Alces alces' } });

      expect(mockOnChange).toHaveBeenCalledWith([
        { featureTypeName: 'animal', propertyName: 'scientific_name', propertyType: 'string', value: 'Alces alces' }
      ]);
    });
  });
});
