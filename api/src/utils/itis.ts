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

  // Function to check if an item is a match with search terms
  const checkForMatch = (item: TaxonSearchResult, searchTerms: string[]) => {
    // Lowercase commonName and split into individual words
    const commonNameWords = item.commonName && item.commonName.toLowerCase().split(/\s+/);

    // Lowercase scientificName and split into individual words
    const scientificNameWords = item.scientificName.toLowerCase().split(/\s+/);

    // Check if any word in commonName or scientificName matches any word in searchTerms
    return searchTerms.some(
      (searchTerm) =>
        scientificNameWords.some((word) => word === searchTerm) ||
        (commonNameWords && commonNameWords.some((word) => word === searchTerm))
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
      return 0; // Place other items after items from searchTerms
    } else {
      return 0; // Maintain the original order if both are from searchTerms or both are not
    }
  };

  // Function to check if an item is a match with search terms
  const checkForMatch = (item: TaxonSearchResult, searchTerms: string[]) => {
    // Lowercase commonName and split into individual words
    const commonNameWords = item.commonName && item.commonName.toLowerCase();

    // Lowercase scientificName and split into individual words
    const scientificNameWords = item.scientificName.toLowerCase();

    const joinedSearchTerms = searchTerms.join(' ');

    return scientificNameWords.includes(joinedSearchTerms) || commonNameWords?.includes(joinedSearchTerms);
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
    const commonNameWord = item.commonName && item.commonName.toLowerCase();

    const scientificNameWord = item.scientificName.toLowerCase();

    return scientificNameWord === searchTerms.join(' ') || commonNameWord === searchTerms.join(' ');
  };

  return data.sort(customSort);
};
