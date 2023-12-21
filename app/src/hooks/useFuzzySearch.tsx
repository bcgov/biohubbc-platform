import Fuse, { FuseResult, IFuseOptions, RangeTuple } from 'fuse.js';
import { ChangeEvent, useEffect, useState } from 'react';
import useDebounce from './useDebounce';

interface IUseFuzzyOptions<T> extends IFuseOptions<T> {
  highlightColour?: string;
  debounceDelayMs?: number;
}

/**
 * hook to consolidate common fuzzy finding utilities
 * 1. fuzzy finding against data set
 * 2. handling search value
 * 3. filtering data set
 * 4. highlighting with matched indices
 *
 * @template T - object of some type
 * @param {T[]} [data] - dataset to fuzzy find against
 * @param {IUseFuzzyOptions<T>} [options={}] - fuse options + additional customizations
 * @returns {*}
 */
const useFuzzySearch = <T,>(data?: T[], options: IUseFuzzyOptions<T> = {}) => {
  const { highlightColour, debounceDelayMs, ...customOptions } = options;
  const defaultFuzzyOptions: IFuseOptions<T> = {
    // keys to search object array for
    // prioritizes shorter key names by default ie: title > description
    keys: [],
    // starting location of search ie: index 100
    location: 100,
    // distance from location value can be
    distance: 200,
    // calculates exact match with location and distance
    threshold: 0.5,
    // only run the fuzzy search when more than 2 characters entered
    minMatchCharLength: 3,
    // provides the match indices used for highlighting
    includeMatches: true,
    // extends the search to use logical query operators
    useExtendedSearch: true
  };

  const optionsOverride = { ...defaultFuzzyOptions, ...customOptions };

  const [searchValue, setSearchValue] = useState('');
  const [defaultFuzzyData, setDefaultFuzzyData] = useState<FuseResult<T>[]>([]);

  const [fuzzyData, setFuzzyData] = useState<FuseResult<T>[]>([]);

  /**
   * set fuzzyData and defaultFuzzyData
   * onMount / change of data generate fuzzyData of same structure fuse expects
   * useful for having a single array to render
   *
   */
  useEffect(() => {
    const dataAsFuzzy =
      data?.map((item, refIndex) => ({
        item,
        refIndex,
        matches: []
      })) ?? [];
    setDefaultFuzzyData(dataAsFuzzy);
    setFuzzyData(dataAsFuzzy);
  }, [data]);

  /**
   * handles fuzzy finding a value for data and sorting new fuzzy data
   *
   * @param {string} value - string to fuzzy find against
   */
  const handleFuzzy = (value: string) => {
    if (!value || (optionsOverride?.minMatchCharLength && value.length < optionsOverride?.minMatchCharLength)) {
      setFuzzyData(defaultFuzzyData);
      return;
    }

    const fuse = new Fuse(data ?? [], optionsOverride);

    /**
     * modify the value to include the fuse.js logical 'OR' operator
     * ie: 'moose | dataset'
     *
     */
    const searchValue = value.replaceAll(' ', ' | ');
    const fuzzyDatasets = fuse.search(searchValue);
    setFuzzyData(fuzzyDatasets);
  };

  /**
   * delay repeatedly calling handleFuzzy
   *
   */
  const debounceFuzzySearch = useDebounce(() => {
    handleFuzzy(searchValue);
  }, debounceDelayMs ?? 350);

  /**
   * sets the search value and debounces the immediate following requests
   * ie: as user types, it only fuzzy finds/sorts after a set amount of ms
   *
   * @param {ChangeEvent<any>} event
   */
  const handleSearch = (event: ChangeEvent<any>) => {
    const value: string = event.target.value;

    setSearchValue(value);

    debounceFuzzySearch();
  };

  /**
   * highlights sections of a string from array of start/end indices
   * ex: <>hello <mark>world!</mark><>
   * @param {string} value - string to highlight
   * @param {readonly RangeTuple[]} [indices] - array of start end indexes ie: [[0,1], [4,5]]
   * @param {number} [i] - index used for recursion
   * @returns {string | JSX.Element} returns string or highlighted fragment
   */
  const highlight = (value: string, indices: readonly RangeTuple[] = [], i = 1): string | JSX.Element => {
    const pair = indices[indices.length - i];
    return !pair ? (
      value
    ) : (
      <>
        {highlight(value.substring(0, pair[0]), indices, i + 1)}
        <mark style={{ backgroundColor: highlightColour ?? '#3B99FC' }}>{value.substring(pair[0], pair[1] + 1)}</mark>
        {value.substring(pair[1] + 1)}
      </>
    );
  };

  /**
   * handler for manually setting fuzzyData, usefull if using external sorting
   *
   * @param {FuseResult<T>[]} newFuzzyData
   */
  const handleFuzzyData = (newFuzzyData: FuseResult<T>[]) => {
    setFuzzyData(newFuzzyData);
  };

  return { fuzzyData, handleFuzzyData, handleSearch, searchValue, highlight };
};

export default useFuzzySearch;
