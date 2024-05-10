import { TaxonSearchResult } from '../services/taxonomy-service';

/**
 * Sorts the ITIS response by how strongly records match the search terms
 *
 * @param {TaxonSearchResult[]} data
 * @param {string[]} searchTerms
 * @return {*}  {TaxonSearchResult[]}
 */
export const sortTaxonSearchResults = (data: TaxonSearchResult[], searchTerms: string[]): TaxonSearchResult[] => {
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
    return commonNames.map((name) => {
      if (!commonNamesDataMap.has(name)) {
        const lowercased = name.toLowerCase();
        commonNamesDataMap.set(name, { words: lowercased.trim().split(' '), lowercased });
      }

      return commonNamesDataMap.get(name) as { words: string[]; lowercased: string };
    });
  };

  /**
   * Custom scoring function to determine how well a record matches the search terms
   *
   * @param {TaxonSearchResult} item
   * @return {*}
   */
  const calculateScore = (item: TaxonSearchResult) => {
    let score = 0;

    const scientificNameData = getScientificNameData(item.scientificName);
    const commonNamesData = getCommonNamesData(item.commonNames);

    // Check if any word in the scientific or common name matches ANY of the search terms
    if (
      searchTermsLower.some(
        (term) => scientificNameData.words.includes(term) || commonNamesData.some((data) => data.words.includes(term))
      )
    ) {
      score += 1;
    }

    // Check if either the scientific name or any common name CONTAINS the search terms joined
    if (
      scientificNameData.lowercased.includes(searchTermJoined) ||
      commonNamesData.some((data) => data.lowercased.includes(searchTermJoined))
    ) {
      score += 2;
    }

    // Check if either the scientific name or any common name is EXACTLY EQUAL to the search terms joined
    if (
      scientificNameData.lowercased === searchTermJoined ||
      commonNamesData.some((data) => data.lowercased === searchTermJoined)
    ) {
      score += 3;
    }

    return score;
  };

  // Sort the data by the score
  return data.sort((a, b) => calculateScore(b) - calculateScore(a));
};
