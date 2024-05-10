import { expect } from 'chai';
import { describe } from 'mocha';
import { TaxonSearchResult } from '../services/taxonomy-service';
import { sortTaxonSearchResults } from './itis-sort';

describe.only('itis-sort', () => {
  describe('sortTaxonSearchResults', () => {
    it('Sorts the list when there is only 1 item', () => {
      const data: TaxonSearchResult[] = [
        {
          tsn: 1,
          commonNames: ['Moose', 'moose'],
          scientificName: 'Alces alces'
        }
      ];
      const searchTerms = ['Moose'];

      const result = sortTaxonSearchResults(data, searchTerms);

      expect(result.length).to.equal(data.length);
      expect(result[0].tsn).to.equal(1);
    });

    it('Sorts the list when there are exact matches', () => {
      const data: TaxonSearchResult[] = [
        {
          tsn: 1,
          commonNames: ['Goose', 'goose'],
          scientificName: 'Goose goose'
        },
        {
          tsn: 2,
          commonNames: ['Moose', 'moose'],
          scientificName: 'Moose moose'
        },
        {
          tsn: 3,
          commonNames: ['House'],
          scientificName: 'House'
        }
      ];
      const searchTerms = ['Moose'];

      const result = sortTaxonSearchResults(data, searchTerms);

      expect(result.length).to.equal(data.length);
      expect(result[0].tsn).to.equal(2);
      expect(result[1].tsn).to.equal(1);
      expect(result[2].tsn).to.equal(3);
    });

    it('Sorts the list when there are no exact matches', () => {
      const data: TaxonSearchResult[] = [
        {
          tsn: 1,
          commonNames: ['Goose', 'goose'],
          scientificName: 'Goose goose'
        },
        {
          tsn: 2,
          commonNames: ['Moose', 'moose'],
          scientificName: 'Moose moose'
        },
        {
          tsn: 3,
          commonNames: ['House'],
          scientificName: 'House'
        }
      ];
      const searchTerms = ['oose'];

      const result = sortTaxonSearchResults(data, searchTerms);

      expect(result.length).to.equal(data.length);
      expect(result[0].tsn).to.equal(1);
      expect(result[1].tsn).to.equal(2);
      expect(result[2].tsn).to.equal(3);
    });
  });
});
