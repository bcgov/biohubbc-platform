import { SearchInput } from 'features/search/SearchComponent';
import Fuse, { FuseResult } from 'fuse.js';
import { ChangeEvent, useState } from 'react';
import { IDataset } from '../DatasetListPage';

const fuseOptions = {
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
  minMatchCharLength: 2,
  includeMatches: true
};

interface DatasetFuzzySearchProps {
  originalDatasets: IDataset[];
  originalFuzzyDatasets: FuseResult<IDataset>[];
  handleFuzzyDatasets: (datasets: FuseResult<IDataset>[]) => void;
}

const DatasetFuzzySearch = (props: DatasetFuzzySearchProps) => {
  const [fuzzySearch, setFuzzySearch] = useState('');

  const handleFuzzy = (value: string) => {
    if (!value || value.length === 1) {
      props.handleFuzzyDatasets(props.originalFuzzyDatasets);
      return;
    }

    const fuse = new Fuse(props.originalDatasets, fuseOptions);
    const fuzzyDatasets = fuse.search(value);
    props.handleFuzzyDatasets(fuzzyDatasets);
  };

  const handleSearch = (e: ChangeEvent<any>) => {
    const value: string = e.target.value;

    setFuzzySearch(value);

    handleFuzzy(value);
  };

  return (
    <SearchInput placeholderText="Enter a dataset title or keyword" value={fuzzySearch} handleChange={handleSearch} />
  );
};

export default DatasetFuzzySearch;
