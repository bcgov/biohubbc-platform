import CheckBox from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import Autocomplete from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import { SxProps, Theme } from '@mui/material/styles';
import CustomTextField from 'components/fields/CustomTextField';
import { ITagSummary } from 'interfaces/useTagsApi.interface';
import { TagChip } from './TagChip';

export interface ITagAutocompleteProps<T extends ITagSummary> {
  id: string;
  label?: string;
  placeholder?: string;
  /** Tags the user can pick from. */
  options: T[];
  /** Tags currently picked; a picked tag is shown even before `options` has loaded. */
  value: T[];
  /** Called with the complete set of picked tags after each change. */
  onChange: (tags: T[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

/**
 * Multi-select of tags: picked tags show as colored tag chips, and each option shows a checkbox and its tag chip.
 * Options are matched by `tag_id`, so they must not repeat a tag.
 *
 * @template T The tag shape picked, such as a board's tags.
 * @param {ITagAutocompleteProps<T>} props The options, the picked tags and the change handler.
 * @returns {JSX.Element} The tag multi-select.
 */
export const TagAutocomplete = <T extends ITagSummary>(props: ITagAutocompleteProps<T>) => {
  const { id, label, placeholder, options, value, onChange, isLoading, disabled, size, sx } = props;

  return (
    <Autocomplete<T, true>
      id={id}
      data-testid={id}
      multiple
      autoHighlight
      disableCloseOnSelect
      size={size}
      sx={sx}
      loading={isLoading}
      disabled={disabled}
      options={options}
      value={value}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, selected) => option.tag_id === selected.tag_id}
      onChange={(_event, tags) => onChange(tags)}
      renderValue={(tags, getItemProps) =>
        tags.map((tag, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return <TagChip {...itemProps} key={key} tag={tag} />;
        })
      }
      renderOption={(optionProps, option, { selected }) => {
        const { key, ...liProps } = optionProps;
        return (
          <li {...liProps} key={key}>
            <Checkbox
              icon={<CheckBoxOutlineBlank fontSize="small" />}
              checkedIcon={<CheckBox fontSize="small" color="primary" />}
              sx={{ mr: 1 }}
              checked={selected}
            />
            <TagChip tag={option} />
          </li>
        );
      }}
      renderInput={(params) => <CustomTextField {...params} label={label} placeholder={placeholder} />}
    />
  );
};
