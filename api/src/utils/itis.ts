
import { TaxonSearchResult } from '../services/taxonomy-service';

/**
 * Sorts the ITIS response such that exact matches with search terms are first
 *
 * @param {TaxonSearchResult[]} data
 * @param {string[]} searchTerms
 * @returns {TaxonSearchResult[]}
 */
export const sortExactMatches = (data: TaxonSearchResult[], searchTerms: string[]): TaxonSearchResult[] => {
  const searchTermLower = searchTerms.join(' ').toLowerCase();

  return data.sort((a, b) => {
    const aMatch = checkForMatch(a);
    const bMatch = checkForMatch(b);

    // Prioritize exact matches over partial matches
    if (aMatch.exact && !bMatch.exact) {
      return -1;
    } else if (!aMatch.exact && bMatch.exact) {
      return 1;
    } else {
      // If both are exact matches or both are not, sort based on partial matches
      if (aMatch.partial && !bMatch.partial) {
        return -1;
      } else if (!aMatch.partial && bMatch.partial) {
        return 1;
      } else {
        return 0;
      }
    }
  });

  function checkForMatch(item: TaxonSearchResult) {
    const commonNameWord = item.commonName && item.commonName.toLowerCase();
    const scientificNameWord = item.scientificName.toLowerCase();

    return {
      exact: commonNameWord === searchTermLower || scientificNameWord === searchTermLower,
      partial: commonNameWord?.includes(searchTermLower) || scientificNameWord.includes(searchTermLower)
    };
  }
};
