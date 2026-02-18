import { expect } from 'chai';
import { describe, it } from 'mocha';
import { getLogger } from './logger';

describe('logger', () => {
  describe('getLogger', () => {
    it('returns a logger wrapper with standard log methods', () => {
      const logger = getLogger('myLogger');

      expect(logger).to.be.an('object');
      expect(logger).to.have.property('info').that.is.a('function');
      expect(logger).to.have.property('error').that.is.a('function');
      expect(logger).to.have.property('warn').that.is.a('function');
      expect(logger).to.have.property('debug').that.is.a('function');
      expect(logger).to.have.property('silly').that.is.a('function');
    });
  });
});
