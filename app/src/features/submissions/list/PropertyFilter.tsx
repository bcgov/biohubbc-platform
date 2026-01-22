import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { FeaturePropertyCode } from 'interfaces/useCodesApi.interface';
import { IPropertyFilter } from 'interfaces/useSearchApi.interface';

export interface IPropertyFilterProps {
  filter: IPropertyFilter;
  availableProperties: FeaturePropertyCode[];
  onChange: (filter: IPropertyFilter) => void;
  onRemove: () => void;
}

/**
 * A single property filter row with property name dropdown and value input.
 *
 * @param {IPropertyFilterProps} props
 * @returns {JSX.Element}
 */
export const PropertyFilter = (props: IPropertyFilterProps) => {
  const { filter, availableProperties, onChange, onRemove } = props;

  // Find the currently selected property for display
  const selectedProperty = availableProperties.find((p) => p.feature_property_name === filter.propertyName) || null;

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Autocomplete
        size="small"
        sx={{ minWidth: 200 }}
        options={availableProperties}
        getOptionLabel={(option) => option.feature_property_display_name}
        value={selectedProperty}
        onChange={(_, newValue) => {
          onChange({
            ...filter,
            propertyName: newValue?.feature_property_name || ''
          });
        }}
        renderInput={(params) => <TextField {...params} label="Property" placeholder="Select property" />}
        isOptionEqualToValue={(option, value) => option.feature_property_name === value.feature_property_name}
      />
      <TextField
        size="small"
        sx={{ minWidth: 200 }}
        label="Value"
        placeholder="Enter value"
        value={filter.value}
        onChange={(e) => {
          onChange({
            ...filter,
            value: e.target.value
          });
        }}
      />
      <IconButton size="small" onClick={onRemove} aria-label="Remove filter">
        <Icon path={mdiClose} size={0.875} />
      </IconButton>
    </Stack>
  );
};

export default PropertyFilter;
