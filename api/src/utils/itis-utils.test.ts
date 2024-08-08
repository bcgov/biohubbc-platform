import { expect } from 'chai';
import { describe } from 'mocha';
import { TaxonSearchResult } from '../services/taxonomy-service';
import { getItisTaxonCommonNames, sortTaxonSearchResults } from './itis-utils';

describe('itis-sort', () => {
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

describe('getItisTaxonCommonNames', () => {
  it('Returns an empty array if provided common names is undefined', () => {
    const rawCommonNames = undefined;

    const commonNames = getItisTaxonCommonNames(rawCommonNames);

    expect(commonNames).to.eql([]);
  });

  it('Returns an empty array if the provided common names is empty', () => {
    const rawCommonNames: string[] = [];

    const commonNames = getItisTaxonCommonNames(rawCommonNames);

    expect(commonNames).to.eql([]);
  });

  it('Returns an array of english common names', () => {
    const rawCommonNames = [
      '$withered wooly milk-vetch (German)$German$N$152846$2012-12-21 00:00:00$',
      '$withered wooly milk-vetch$English$N$152846$2012-12-21 00:00:00$',
      '$woolly locoweed$English$N$124501$2011-06-29 00:00:00$',
      '$Davis Mountains locoweed (French)$French$N$124502$2011-06-29 00:00:00$',
      '$Davis Mountains locoweed$English$N$124502$2011-06-29 00:00:00$',
      '$woolly milkvetch$English$N$72035$2012-12-21 00:00:00$',
      '$woolly milkvetch (French)$French$N$124502$2011-06-29 00:00:00$'
    ];

    const commonNames = getItisTaxonCommonNames(rawCommonNames);

    expect(commonNames).to.eql([
      'withered wooly milk-vetch',
      'woolly locoweed',
      'Davis Mountains locoweed',
      'woolly milkvetch'
    ]);
  });
});
