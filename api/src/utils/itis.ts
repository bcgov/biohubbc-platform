import { TaxonSearchResult } from '../services/taxonomy-service';

/**
 * Sorts the ITIS response by how strongly records match the search terms
 *
 * @param {ItisSolrSearchResponse[]} data
 * @param {string[]} searchTerms
 * @memberof ItisService
 */
export const sortExactMatches = (data: TaxonSearchResult[], searchTerms: string[]): TaxonSearchResult[] => {
  const searchTermsLower = searchTerms.map((item) => item.toLowerCase());

  // Prioritize taxa where any word in the scientific or common name matches ANY of the search terms
  // eg. ['Black', 'bear'] -> "Black" matches on "Black widow"
  const containsAnyMatch = customSortContainsAnyMatchingSearchTerm(data, searchTermsLower);

  // Prioritize taxa where either the scientific name or any common name CONTAINS the search terms joined
  // eg. ['Black', 'bear'] -> "Black bear" matches on "American black bear"
  const containsAnyMatchJoined = customSortContainsSearchTermsJoinedExact(containsAnyMatch, searchTermsLower);

  // Prioritize taxa where either the scientific name or any common name is EXACTLY EQUAL to the search terms joined
  // eg. ['Wolf'] -> "Wolf" is prioritized over "Forest Wolf"
  const exactlyEquals = customSortEqualsSearchTermsExact(containsAnyMatchJoined, searchTermsLower);

  return exactlyEquals;
};

/**
 * Sorts the ITIS response to prioritize records where any word in the scientific or
 * common name matches ANY of the search terms
 *
 * @param {ItisSolrSearchResponse[]} data
 * @param {string[]} searchTerms
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
    const commonNameWords = item.commonNames?.flatMap((name: string) => name.toLowerCase().split(/\s+/));
    const scientificNameWords = item.scientificName.toLowerCase().split(/\s+/);

    // Check if any word in commonNames or scientificName matches any word in searchTerms
    return searchTerms.some(
      (searchTerm) => scientificNameWords?.includes(searchTerm) || commonNameWords?.includes(searchTerm)
    );
  };

  return data.sort(customSort);
};

/**
 * Sorts the ITIS response to prioritize records where either the scientific name or
 * any common name CONTAINS the search terms joined
 *
 * @param {ItisSolrSearchResponse[]} data
 * @param {string[]} searchTerms
 * @memberof ItisService
 */
export const customSortContainsSearchTermsJoinedExact = (
  data: TaxonSearchResult[],
  searchTerms: string[]
): TaxonSearchResult[] => {
  const customSort = (a: TaxonSearchResult, b: TaxonSearchResult) => {
    const aInReference = checkForMatch(a, searchTerms);
    const bInReference = checkForMatch(b, searchTerms);

    if (aInReference && !bInReference) {
      return -1; // Place items from searchTerms before other items
    } else if (!aInReference && bInReference) {
      return 0; // Maintain the original order
    } else {
      return 0; // Maintain the original order
    }
  };

  // Function to check if an item is a match with search terms
  const checkForMatch = (item: TaxonSearchResult, searchTerms: string[]) => {
    const commonNameWords = item.commonNames?.map((name: string) => name.toLowerCase());
    const scientificNameWord = item.scientificName.toLowerCase();

    // Add a space such that "Black bear" matches "American black bear" and not "Black Bearded"
    return (
      scientificNameWord === searchTerms.join(' ') ||
      commonNameWords?.some((name) => `${name}${' '}`.includes(`${searchTerms.join(' ')}${' '}`))
    );
  };

  return data.sort(customSort);
};

/**
 * Sorts the ITIS response to prioritize taxa where either the scientific name or
 * any common name is EXACTLY EQUAL to the search terms joined
 *
 * @param {ItisSolrSearchResponse[]} data
 * @memberof ItisService
 */
export const customSortEqualsSearchTermsExact = (
  data: TaxonSearchResult[],
  searchTerms: string[]
): TaxonSearchResult[] => {
  const customSort = (a: TaxonSearchResult, b: TaxonSearchResult) => {
    const aInReference = checkForMatch(a, searchTerms);
    const bInReference = checkForMatch(b, searchTerms);

    if (aInReference && !bInReference) {
      return -1; // Place items from searchTerms before other items
    } else if (!aInReference && bInReference) {
      return 0; // Maintain the original order
    } else {
      return 0; // Maintain the original order
    }
  };

  // Function to check if an item is a match with search terms
  const checkForMatch = (item: TaxonSearchResult, searchTerms: string[]) => {
    const commonNameWords = item.commonNames?.map((name: string) => name.toLowerCase());
    const scientificNameWord = item.scientificName.toLowerCase();

    return scientificNameWord === searchTerms.join(' ') || commonNameWords?.includes(searchTerms.join(' '));
  };

  return data.sort(customSort);
};
