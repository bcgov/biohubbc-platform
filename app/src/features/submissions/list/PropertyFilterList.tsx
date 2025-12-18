import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import PropertyFilter from 'features/submissions/list/PropertyFilter';
import { FeaturePropertyCode } from 'interfaces/useCodesApi.interface';
import { IPropertyFilter } from 'interfaces/useSearchApi.interface';

export interface IPropertyFilterListProps {
  filters: IPropertyFilter[];
  availableProperties: FeaturePropertyCode[];
  onChange: (filters: IPropertyFilter[]) => void;
}

/**
 * Renders a list of property filters with update/remove functionality.
 *
 * @param {IPropertyFilterListProps} props
 * @returns {JSX.Element}
 */
export const PropertyFilterList = (props: IPropertyFilterListProps) => {
  const { filters, availableProperties, onChange } = props;

  const handleUpdateFilter = (index: number, updatedFilter: IPropertyFilter) => {
    const newFilters = [...filters];
    newFilters[index] = updatedFilter;
    onChange(newFilters);
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    onChange(newFilters);
  };

  return (
    <Box>
      <Collapse in={filters.length > 0}>
        <Stack spacing={1}>
          {filters.map((filter, index) => (
            <PropertyFilter
              key={index}
              filter={filter}
              availableProperties={availableProperties}
              onChange={(updatedFilter) => handleUpdateFilter(index, updatedFilter)}
              onRemove={() => handleRemoveFilter(index)}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
};

export default PropertyFilterList;
