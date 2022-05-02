import { expect } from 'chai';
import { describe } from 'mocha';
import { getOccurrencesForViewSQL } from './occurrence-view-queries';

describe('getOccurrencesForViewSQL', () => {
  it('returns a SQL statement', () => {
    const response = getOccurrencesForViewSQL(1);

    expect(response).to.not.be.null;
  });
});
