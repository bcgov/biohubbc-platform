import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SearchAutocomplete } from 'components/search/SearchAutocomplete';
import { SearchOption } from 'components/search/SearchAutocomplete.interface';
import { useApi } from 'hooks/useApi';
import useDebounce from 'hooks/useDebounce';
import { useEffect, useMemo, useState } from 'react';
import { searchQueryKeys } from 'utils/query-keys/search-query-keys';
import { ExpressionBuilderPredicateTokenTaxonProps } from './ExpressionBuilderPredicateToken.interface';
import { ExpressionBuilderPredicateTokenValueControl } from './ExpressionBuilderPredicateTokenValueControl';

/**
 * Renders the taxon predicate value selector.
 *
 * Taxon predicate values are ITIS TSNs. The autocomplete searches local
 * taxonomy, while free-solo numeric input lets users enter any valid TSN even
 * before it exists in the local taxonomy table.
 *
 * @param {ExpressionBuilderPredicateTokenTaxonProps} props - Taxon TSN value, validation state, and change callback.
 * @returns {JSX.Element} Taxon autocomplete value control.
 */
export const ExpressionBuilderPredicateTokenTaxon = ({
  value,
  error,
  readOnly = false,
  onChange
}: ExpressionBuilderPredicateTokenTaxonProps) => {
  const api = useApi();
  const [selectedTaxonOption, setSelectedTaxonOption] = useState<SearchOption | null>(null);
  // The settled text local taxonomy is searched for; empty searches nothing and offers no options.
  const [taxonSearch, setTaxonSearch] = useState('');

  const taxonOptionsQuery = useQuery({
    queryKey: searchQueryKeys.taxonOptions(taxonSearch),
    queryFn: ({ signal }) => api.search.searchTaxon({ keyword: taxonSearch }, { page: 1, limit: 25 }, { signal }),
    enabled: taxonSearch.length > 0,
    placeholderData: keepPreviousData
  });
  const taxonOptions = useMemo<SearchOption[]>(
    () =>
      taxonSearch
        ? (taxonOptionsQuery.data?.taxonomy.map((taxon) => ({
            label: taxon.itis_scientific_name,
            value: taxon.itis_tsn
          })) ?? [])
        : [],
    [taxonOptionsQuery.data, taxonSearch]
  );

  // Use for local taxonomy autocomplete lookups while the user types a taxon value.
  const debouncedTaxonSearch = useDebounce(setTaxonSearch, 300);

  useEffect(() => () => debouncedTaxonSearch.cancel(), [debouncedTaxonSearch]);

  let selectedTaxon: SearchOption | null = null;

  if (selectedTaxonOption?.value === value) {
    selectedTaxon = selectedTaxonOption;
  } else if (typeof value === 'number') {
    selectedTaxon = { label: String(value), value };
  }

  // Use for both typed text and committed free-solo values so arbitrary TSNs stay valid.
  const setTaxonValueFromInput = (inputValue: string) => {
    const searchTerm = inputValue.trim();

    if (!searchTerm) {
      debouncedTaxonSearch.cancel();
      setTaxonSearch('');
      setSelectedTaxonOption(null);
      onChange(undefined);
      return;
    }

    setSelectedTaxonOption(null);

    if (/^\d+$/.test(searchTerm)) {
      onChange(Number(searchTerm));
    } else {
      onChange(undefined);
    }

    debouncedTaxonSearch(searchTerm);
  };

  // Use when a returned taxon option is explicitly selected from the menu.
  const handleTaxonOptionChange = (option: SearchOption | null) => {
    debouncedTaxonSearch.cancel();
    setSelectedTaxonOption(option);
    onChange(option?.value === undefined ? undefined : Number(option.value));
  };

  return (
    <ExpressionBuilderPredicateTokenValueControl variant="taxon">
      <SearchAutocomplete
        options={taxonOptions}
        value={selectedTaxon}
        ariaLabel="Taxon"
        error={error}
        freeSolo
        showStartAdornment={false}
        placeholder="Taxon"
        disabled={readOnly}
        onInputChange={setTaxonValueFromInput}
        onFreeSoloChange={setTaxonValueFromInput}
        onChange={handleTaxonOptionChange}
      />
    </ExpressionBuilderPredicateTokenValueControl>
  );
};
