import { TaxonSearchResult } from '../services/taxonomy-service';

/**
 * Sorts the ITIS response by how strongly records match the search terms
 *
 * @param {TaxonSearchResult[]} taxonSearchResults
 * @param {string[]} searchTerms
 * @return {*}  {TaxonSearchResult[]}
 */
export const sortTaxonSearchResults = (
  taxonSearchResults: TaxonSearchResult[],
  searchTerms: string[]
): TaxonSearchResult[] => {
  const searchTermsLower = searchTerms.map((item) => item.toLowerCase());
  const searchTermJoined = searchTermsLower.join(' ');

  // Caches the scientific name data
  const scientificNameDataMap = new Map<string, { words: string[]; lowercased: string }>();
  // Caches the common name data
  const commonNamesDataMap = new Map<string, { words: string[]; lowercased: string }>();

  // Returns the scientific name data, adding it to the cache if it doesn't exist
  const getScientificNameData = (scientificName: string) => {
    if (!scientificNameDataMap.has(scientificName)) {
      const lowercased = scientificName.toLowerCase();
      scientificNameDataMap.set(scientificName, { words: lowercased.trim().split(' '), lowercased });
    }

    return scientificNameDataMap.get(scientificName) as { words: string[]; lowercased: string };
  };

  // Returns the common names data, adding it to the cache if it doesn't exist
  const getCommonNamesData = (commonNames: string[]) => {
    return commonNames.map((commonName) => {
      if (!commonNamesDataMap.has(commonName)) {
        const lowercased = commonName.toLowerCase();
        commonNamesDataMap.set(commonName, { words: lowercased.trim().split(' '), lowercased });
      }

      return commonNamesDataMap.get(commonName) as { words: string[]; lowercased: string };
    });
  };

  /**
   * Custom scoring function to determine how well a record matches the search terms.
   *
   * @param {TaxonSearchResult} taxonSearchResult
   * @return {*}
   */
  const calculateScore = (taxonSearchResult: TaxonSearchResult) => {
    let score = 0;

    const scientificNameData = getScientificNameData(taxonSearchResult.scientificName);
    const commonNamesData = getCommonNamesData(taxonSearchResult.commonNames);

    // Check if any word in the scientific or common name matches ANY of the search terms
    // eg. ['Black', 'bear'] -> "Black" matches on "Black widow"
    if (
      searchTermsLower.some(
        (term) => scientificNameData.words.includes(term) || commonNamesData.some((data) => data.words.includes(term))
      )
    ) {
      score += 1;
    }

    // Check if either the scientific name or any common name CONTAINS the search terms joined
    // eg. ['Black', 'bear'] -> "Black bear" matches on "American black bear"
    if (
      scientificNameData.lowercased.includes(searchTermJoined) ||
      commonNamesData.some((data) => data.lowercased.includes(searchTermJoined))
    ) {
      score += 2;
    }

    // Check if either the scientific name or any common name is EXACTLY EQUAL to the search terms joined
    // eg. ['Wolf'] -> "Wolf" is prioritized over "Forest Wolf"
    if (
      scientificNameData.lowercased === searchTermJoined ||
      commonNamesData.some((data) => data.lowercased === searchTermJoined)
    ) {
      score += 3;
    }

    return score;
  };

  // Sort the data by the score
  return taxonSearchResults.sort((a, b) => calculateScore(b) - calculateScore(a));
};

/**
 * Parse the raw common names string from an ITIS taxon record into an array of english common names.
 *
 * @example
 * const commonNames = [
 *   '$withered wooly milk-vetch$English$N$152846$2012-12-21 00:00:00$',
 *   '$woolly locoweed$English$N$124501$2011-06-29 00:00:00$',
 *   '$Davis Mountains locoweed$English$N$124502$2011-06-29 00:00:00$',
 *   '$woolly milkvetch$English$N$72035$2012-12-21 00:00:00$'
 * ]
 *
 * const result = getItisTaxonCommonNames(commonNames)
 * // result: ['withered wooly milk-vetch', 'woolly locoweed', 'Davis Mountains locoweed', 'woolly milkvetch']
 *
 * @param {string[]} [commonNames]
 * @memberof TaxonomyService
 */
export const getItisTaxonCommonNames = (commonNames?: string[]): string[] => {
  return commonNames?.filter((name) => name.split('$')[2] === 'English').map((name) => name.split('$')[1]) ?? [];
};
