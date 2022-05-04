import { expect } from 'chai';
import { describe } from 'mocha';
import { GetOccurrencesViewData } from './view';

describe('GetOccurrencesViewData', () => {
  describe('No values provided', () => {
    let data: GetOccurrencesViewData;

    before(() => {
      data = new GetOccurrencesViewData(null);
    });

    it('sets occurrences', () => {
      expect(data.occurrences).to.equal(null);
    });
  });

  describe('All values provided', () => {
    let data: GetOccurrencesViewData;

    before(() => {
      data = new GetOccurrencesViewData([
        {
          occurrence_id: 1,
          submission_id: 2,
          taxonid: 'taxonid',
          lifestage: 'lifestage',
          sex: 'sex',
          eventdate: 'eventdate',
          vernacularname: 'vernacularname',
          individualcount: 3,
          organismquantity: 4,
          organismquantitytype: 'organismquantitytype',
          geometry: '{ "test": 1 }'
        }
      ]);
    });

    it('sets occurrenceId', () => {
      expect(data.occurrences[0].occurrenceId).to.equal(1);
    });

    it('sets submissionId', () => {
      expect(data.occurrences[0].submissionId).to.equal(2);
    });

    it('sets taxonId', () => {
      expect(data.occurrences[0].taxonId).to.equal('taxonid');
    });

    it('sets lifeStage', () => {
      expect(data.occurrences[0].lifeStage).to.equal('lifestage');
    });

    it('sets sex', () => {
      expect(data.occurrences[0].sex).to.equal('sex');
    });

    it('sets eventDate', () => {
      expect(data.occurrences[0].eventDate).to.equal('eventdate');
    });

    it('sets vernacularName', () => {
      expect(data.occurrences[0].vernacularName).to.equal('vernacularname');
    });

    it('sets individualCount', () => {
      expect(data.occurrences[0].individualCount).to.equal(3);
    });

    it('sets organismQuantity', () => {
      expect(data.occurrences[0].organismQuantity).to.equal(4);
    });

    it('sets organismQuantityType', () => {
      expect(data.occurrences[0].organismQuantityType).to.equal('organismquantitytype');
    });

    it('sets geometry', () => {
      expect(data.occurrences[0].geometry).to.eql({
        type: 'Feature',
        geometry: { test: 1 },
        properties: {}
      });
    });
  });
});
