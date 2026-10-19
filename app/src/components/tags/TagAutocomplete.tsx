import CheckBox from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import Autocomplete, { AutocompleteInputChangeReason } from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import { SxProps, Theme } from '@mui/material/styles';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import CustomTextField from 'components/fields/CustomTextField';
import { TAG_SEARCH_LIMIT } from 'constants/tag';
import { useApi } from 'hooks/useApi';
import useDebouncedValue from 'hooks/useDebouncedValue';
import { ITagSummary, ITagsQueryParams } from 'interfaces/useTagsApi.interface';
import { SyntheticEvent, useState } from 'react';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import { TagChip } from './TagChip';

export interface ITagAutocompleteProps {
  id: string;
  label?: string;
  placeholder?: string;
  /** Tags currently picked; they stay shown whether or not the current search matches them. */
  value: ITagSummary[];
  /** Called with the complete set of picked tags after each change. */
  onChange: (tags: ITagSummary[]) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

/**
 * Multi-select of tags that searches the tags by name as the user types: picked tags show as colored tag chips, and
 * each option shows a checkbox and its tag chip. Options are the first page of matching tags plus the picked tags, so
 * picked tags stay checked while the search changes. Tag changes refresh the search through `changedQueryKeys.tag`.
 *
 * @param {ITagAutocompleteProps} props The picked tags and the change handler.
 * @returns {JSX.Element} The tag multi-select.
 */
export const TagAutocomplete = (props: ITagAutocompleteProps) => {
  const { id, label, placeholder, value, onChange, disabled, size, sx } = props;
  const api = useApi();

  const [inputValue, setInputValue] = useState('');
  const debouncedSearch = useDebouncedValue(inputValue);

  const searchParams: ITagsQueryParams = { search: debouncedSearch, page: 1, limit: TAG_SEARCH_LIMIT };
  const tagsQuery = useQuery({
    queryKey: tagQueryKeys.list(searchParams),
    queryFn: ({ signal }) => api.tags.getTags(searchParams, { signal }),
    placeholderData: keepPreviousData
  });

  const matchingTags: ITagSummary[] = tagsQuery.data?.tags ?? [];
  const unmatchedPickedTags = value.filter(
    (pickedTag) => !matchingTags.some((matchingTag) => matchingTag.tag_id === pickedTag.tag_id)
  );
  const options = [...matchingTags, ...unmatchedPickedTags];

  /**
   * Keeps the typed search. Picking a tag or leaving the field resets the input, which would discard the search while
   * the user is still picking, so only typing and clearing change it.
   *
   * @param {SyntheticEvent} _event The input event.
   * @param {string} nextInputValue The input's new text.
   * @param {AutocompleteInputChangeReason} reason Why the input changed.
   * @returns {void}
   */
  const handleInputChange = (_event: SyntheticEvent, nextInputValue: string, reason: AutocompleteInputChangeReason) => {
    if (reason === 'input' || reason === 'clear') {
      setInputValue(nextInputValue);
    }
  };

  return (
    <Autocomplete<ITagSummary, true>
      id={id}
      data-testid={id}
      multiple
      autoHighlight
      disableCloseOnSelect
      size={size}
      sx={sx}
      loading={tagsQuery.isFetching}
      disabled={disabled}
      options={options}
      value={value}
      inputValue={inputValue}
      // The server matches the search; options are not filtered again here.
      filterOptions={(tags) => tags}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, selected) => option.tag_id === selected.tag_id}
      onInputChange={handleInputChange}
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
