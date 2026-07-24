import { expect } from 'chai';
import { describe } from 'mocha';
import { computeMartinContextHash } from './martin-context-hash';

describe('computeMartinContextHash', () => {
  const base = {
    expressionHash: 'expr-1',
    featureTypeId: 21,
    accessClass: 'scoped' as const,
    securityScopeIds: ['b', 'a']
  };

  it('is stable for identical input', () => {
    expect(computeMartinContextHash(base)).to.equal(computeMartinContextHash({ ...base }));
  });

  it('ignores the ordering of scope ids', () => {
    // Two callers with the same grants must share a context however their scopes are ordered.
    expect(computeMartinContextHash({ ...base, securityScopeIds: ['a', 'b'] })).to.equal(
      computeMartinContextHash({ ...base, securityScopeIds: ['b', 'a'] })
    );
  });

  it('separates anonymous from authenticated callers', () => {
    // The critical property: an anonymous visitor must never share cached tiles with a signed-in
    // user, even when they run the same search.
    const anonymous = computeMartinContextHash({ ...base, accessClass: 'anon', securityScopeIds: [] });
    const scoped = computeMartinContextHash({ ...base, accessClass: 'scoped', securityScopeIds: [] });

    expect(anonymous).to.not.equal(scoped);
  });

  it('separates callers whose scope sets differ', () => {
    const narrow = computeMartinContextHash({ ...base, securityScopeIds: ['a'] });
    const wide = computeMartinContextHash({ ...base, securityScopeIds: ['a', 'b'] });

    expect(narrow).to.not.equal(wide);
  });

  it('separates different searches', () => {
    expect(computeMartinContextHash({ ...base, expressionHash: 'expr-2' })).to.not.equal(
      computeMartinContextHash(base)
    );
  });

  it('separates a filtered search from an unfiltered view', () => {
    expect(computeMartinContextHash({ ...base, expressionHash: null })).to.not.equal(computeMartinContextHash(base));
  });

  it('separates different feature types', () => {
    expect(computeMartinContextHash({ ...base, featureTypeId: 24 })).to.not.equal(computeMartinContextHash(base));
  });

  it('returns a sha256 hex digest', () => {
    expect(computeMartinContextHash(base)).to.match(/^[0-9a-f]{64}$/);
  });
});
