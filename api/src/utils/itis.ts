import { TaxonSearchResult } from '../services/taxonomy-service';

/**
 * Sorts the ITIS response such that exact matches with search terms are first
 *
 * @param {ItisSolrSearchResponse[]} data
 * @memberof ItisService
 */
export const sortExactMatches = (data: TaxonSearchResult[], searchTerms: string[]): TaxonSearchResult[] => {
  const searchTermsLower = searchTerms.map((item) => item.toLowerCase());

  const contains = customSortContainsAnyMatchingSearchTerm(data, searchTermsLower);
  const someEquals = customSortContainsSearchTermsJoined(contains, searchTermsLower);
  const exactEquals = customSortEqualsSearchTermsJoined(someEquals, searchTermsLower);

  return exactEquals;
};

/**
 * Sorts the ITIS response such that exact matches with search terms are first
 *
 * @param {ItisSolrSearchResponse[]} data
 * @memberof ItisService
 */
export const customSortContainsAnyMatchingSearchTerm = (
  data: TaxonSearchResult[],
  searchTerms: string[]
): TaxonSearchResult[] => {
  // Custom sorting function
  const customSort = (a: TaxonSearchResult, b: TaxonSearchResult) => {
    const aInReference = checkForMatch(a, searchTerms);
    const bInReference = checkForMatch(b, searchTerms);

    if (aInReference && !bInReference) {
      return -1; // Place items from searchTerms before other items
    } else if (!aInReference && bInReference) {
      return 1; // Place other items after items from searchTerms
    } else {
      return 0; // Maintain the original order if both are from searchTerms or both are not
    }
  };

  const checkForMatch = (item: TaxonSearchResult, searchTerms: string[]) => {
    // Lowercase commonNames and split into individual words
    const commonNameWords = item.commonNames && item.commonNames.flatMap((name) => name.toLowerCase().split(/\s+/));

    // Lowercase scientificName and split into individual words
    const scientificNameWords = item.scientificName.toLowerCase().split(/\s+/);

    // Check if any word in commonNames or scientificName matches any word in searchTerms
    return searchTerms.some(
      (searchTerm) =>
        scientificNameWords.some((word) => word === searchTerm) || // Check if any word in scientific name matches any search term
        commonNameWords?.includes(searchTerm) // Check if any word in common names matches any search term
    );
  };

  return data.sort(customSort);
};

/**
 * Sorts the ITIS response such that exact matches with search terms are first
 *
 * @param {ItisSolrSearchResponse[]} data
 * @memberof ItisService
 */
export const customSortContainsSearchTermsJoined = (
  data: TaxonSearchResult[],
  searchTerms: string[]
): TaxonSearchResult[] => {
  // Custom sorting function
  const customSort = (a: TaxonSearchResult, b: TaxonSearchResult) => {
    const aInReference = checkForMatch(a, searchTerms);
    const bInReference = checkForMatch(b, searchTerms);

    if (aInReference && !bInReference) {
      return -1; // Place items from searchTerms before other items
    } else if (!aInReference && bInReference) {
      return 1; // Place other items after items from searchTerms
    } else {
      return 0; // Maintain the original order if both are from searchTerms or both are not
    }
  };

  // Function to check if an item is a match with search terms
  const checkForMatch = (item: TaxonSearchResult, searchTerms: string[]) => {
    // Lowercase commonNames and split into individual words
    const commonNameWords = item.commonNames && item.commonNames.map((name) => name.toLowerCase());

    // Lowercase scientificName and split into individual words
    const scientificNameWords = item.scientificName.toLowerCase().split(/\s+/);

    return commonNameWords?.includes(searchTerms.join(' ')) || scientificNameWords.includes(searchTerms.join(' '));
  };

  return data.sort(customSort);
};

/**
 * Sorts the ITIS response such that exact matches with search terms are first
 *
 * @param {ItisSolrSearchResponse[]} data
 * @memberof ItisService
 */
export const customSortEqualsSearchTermsJoined = (
  data: TaxonSearchResult[],
  searchTerms: string[]
): TaxonSearchResult[] => {
  // Custom sorting function
  const customSort = (a: TaxonSearchResult, b: TaxonSearchResult) => {
    const aInReference = checkForMatch(a, searchTerms);
    const bInReference = checkForMatch(b, searchTerms);

    if (aInReference && !bInReference) {
      return -1; // Place items from searchTerms before other items
    } else if (!aInReference && bInReference) {
      return 0; // Place other items after items from searchTerms
    } else {
      return 0; // Maintain the original order if both are from searchTerms or both are not
    }
  };

  // Function to check if an item is a match with search terms
  const checkForMatch = (item: TaxonSearchResult, searchTerms: string[]) => {
    const commonNameWords = item.commonNames && item.commonNames.map((name) => name.toLowerCase());

    const scientificNameWord = item.scientificName.toLowerCase();

    // Add a space such that "Black bear" matches "American black bear" and not "Black Bearded"
    return (
      scientificNameWord === searchTerms.join(' ') ||
      commonNameWords?.some((name) => `${name}${' '}`.includes(`${searchTerms.join(' ')}${' '}`))
    );
  };

  return data.sort(customSort);
};
