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
  const taxonNames = data.map((item) => {
    item.scientificName = item.scientificName.toLowerCase();
    item.commonNames = item.commonNames.map((name) => name.toLowerCase());
    return item;
  });

  // Prioritize taxa where any word in the scientific or common name matches ANY of the search terms
  // eg. ['Black', 'bear'] -> "Black" matches on "Black widow"
  const containsAnyMatch = customSortContainsAnyMatchingSearchTerm(taxonNames, searchTermsLower);

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
): TaxonSearchResult[] =>
  data.sort((a, b) => {
    const checkForMatch = (item: TaxonSearchResult) => {
      const commonNameWords = item.commonNames?.flatMap((name) => name.toLowerCase().split(' '));
      const scientificNameWords = item.scientificName.toLowerCase().split(' ');

      // Check if any word in commonNames or scientificName matches any word in searchTerms
      return searchTerms.some(
        (searchTerm) => scientificNameWords.includes(searchTerm) || commonNameWords?.includes(searchTerm)
      );
    };

    const aInReference = checkForMatch(a);
    const bInReference = checkForMatch(b);

    return aInReference && !bInReference ? -1 : !aInReference && bInReference ? 1 : 0;
  });

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
): TaxonSearchResult[] =>
  data.sort((a, b) => {
    const checkForMatch = (item: TaxonSearchResult) => {
      const searchTermString = searchTerms.join(' ');
      return item.commonNames.some((name) => name.includes(searchTermString)) || item.scientificName === searchTermString;
    };

    const aInReference = checkForMatch(a);
    const bInReference = checkForMatch(b);

    return aInReference && !bInReference ? -1 : 0;
  });

/**
 * Sorts the ITIS response to prioritize taxa where either the scientific name or
 * any common name is EXACTLY EQUAL to the search terms joined
 *
 * @param {ItisSolrSearchResponse[]} data
 * @param {string[]} searchTerms
 * @memberof ItisService
 */
export const customSortEqualsSearchTermsExact = (
  data: TaxonSearchResult[],
  searchTerms: string[]
): TaxonSearchResult[] =>
  data.sort((a, b) => {
    const checkForMatch = (item: TaxonSearchResult) =>
      item.scientificName === searchTerms.join(' ') || item.commonNames.includes(searchTerms.join(' '));

    const aInReference = checkForMatch(a);
    const bInReference = checkForMatch(b);

    if (aInReference && !bInReference) {
      return -1; // Place items from searchTerms before other items
    } else {
      return 0; // Maintain the original order
    }
  });
