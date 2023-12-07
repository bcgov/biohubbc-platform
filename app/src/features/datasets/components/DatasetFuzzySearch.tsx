import { SearchInput } from 'features/search/SearchComponent';
import Fuse, { FuseResult, IFuseOptions } from 'fuse.js';
import useDebounce from 'hooks/useDebounce';
import { IDataset } from 'interfaces/useDatasetApi.interface';
import { ChangeEvent, useState } from 'react';

const datasetFuseOptions: IFuseOptions<IDataset> = {
  // keys to search object array for
  // prioritizes shorter key names by default ie: title
  keys: [
    'name',
    //{ name: 'submission_date', getFn: (data: any) => data.submission_date.toDateString() },
    'description'
  ],
  // starting location of search ie: index 100
  location: 100,
  // distance from location value can be
  distance: 200,
  // calculates exact match with location and distance
  threshold: 0.5,
  // only run the fuzzy search when more than 2 characters entered
  minMatchCharLength: 2,
  // provides the match indices used for highlighting
  includeMatches: true,
  // extends the search to use logical query operators
  useExtendedSearch: true
};

interface DatasetFuzzySearchProps {
  originalDatasets: IDataset[];
  originalFuzzyDatasets: FuseResult<IDataset>[];
  handleFuzzyDatasets: (datasets: FuseResult<IDataset>[]) => void;
}

/**
 * dataset fuzzy sort and search
 *
 * @param {DatasetFuzzySearchProps} props
 * @returns {*}
 */
const DatasetFuzzySearch = (props: DatasetFuzzySearchProps) => {
  const [fuzzySearch, setFuzzySearch] = useState('');

  const handleFuzzy = (value: string) => {
    if (!value || value.length === 1) {
      props.handleFuzzyDatasets(props.originalFuzzyDatasets);
      return;
    }

    const fuse = new Fuse(props.originalDatasets, datasetFuseOptions);
    const searchValue = value.replaceAll(' ', ' | ');
    const fuzzyDatasets = fuse.search(searchValue);
    props.handleFuzzyDatasets(fuzzyDatasets);
  };

  const debounceFuzzySearch = useDebounce(() => {
    handleFuzzy(fuzzySearch);
  }, 350);

  const handleSearch = (e: ChangeEvent<any>) => {
    const value: string = e.target.value;

    setFuzzySearch(value);

    debounceFuzzySearch();
  };

  return (
    <SearchInput placeholderText="Enter a dataset title or keywords" value={fuzzySearch} handleChange={handleSearch} />
  );
};

export default DatasetFuzzySearch;
