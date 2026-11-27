import { expect } from 'chai';
import { normalizeCase } from './normalize';

describe('normalize', () => {
  describe('normalizeCase', () => {
    it('trims and lowercases an identifier', () => {
      expect(normalizeCase('  Linework ')).to.equal('linework');
    });

    it('returns an empty string for whitespace', () => {
      expect(normalizeCase('   ')).to.equal('');
    });
  });
});
