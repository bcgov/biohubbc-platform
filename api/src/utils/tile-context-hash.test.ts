import { expect } from 'chai';
import { describe } from 'mocha';
import { computeTileContextHash } from './tile-context-hash';

describe('computeTileContextHash', () => {
  const base = {
    expressionHash: 'expr-1',
    featureTypeId: 21,
    accessClass: 'scoped' as const,
    securityScopeIds: ['b', 'a']
  };

  it('is stable for identical input', () => {
    expect(computeTileContextHash(base)).to.equal(computeTileContextHash({ ...base }));
  });

  it('ignores the ordering of scope ids', () => {
    // Two callers with the same grants must share a context however their scopes are ordered.
    expect(computeTileContextHash({ ...base, securityScopeIds: ['a', 'b'] })).to.equal(
      computeTileContextHash({ ...base, securityScopeIds: ['b', 'a'] })
    );
  });

  it('separates anonymous from authenticated callers', () => {
    // The critical property: an anonymous visitor must never share cached tiles with a signed-in
    // user, even when they run the same search.
    const anonymous = computeTileContextHash({ ...base, accessClass: 'anon', securityScopeIds: [] });
    const scoped = computeTileContextHash({ ...base, accessClass: 'scoped', securityScopeIds: [] });

    expect(anonymous).to.not.equal(scoped);
  });

  it('separates callers whose scope sets differ', () => {
    const narrow = computeTileContextHash({ ...base, securityScopeIds: ['a'] });
    const wide = computeTileContextHash({ ...base, securityScopeIds: ['a', 'b'] });

    expect(narrow).to.not.equal(wide);
  });

  it('separates different searches', () => {
    expect(computeTileContextHash({ ...base, expressionHash: 'expr-2' })).to.not.equal(computeTileContextHash(base));
  });

  it('separates a filtered search from an unfiltered view', () => {
    expect(computeTileContextHash({ ...base, expressionHash: null })).to.not.equal(computeTileContextHash(base));
  });

  it('separates different feature types', () => {
    expect(computeTileContextHash({ ...base, featureTypeId: 24 })).to.not.equal(computeTileContextHash(base));
  });

  it('returns a sha256 hex digest', () => {
    expect(computeTileContextHash(base)).to.match(/^[0-9a-f]{64}$/);
  });
});
