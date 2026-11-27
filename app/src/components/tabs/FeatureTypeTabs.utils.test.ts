import { getFeatureTypeTabsMask } from './FeatureTypeTabs.utils';

describe('getFeatureTypeTabsMask', () => {
  it('does not fade the row while every tab is in view', () => {
    expect(getFeatureTypeTabsMask(false, false)).toBeUndefined();
  });

  it('fades only the end of the row that has tabs past it', () => {
    expect(getFeatureTypeTabsMask(true, false)).toBe('linear-gradient(to right, transparent, #000 96px, #000)');
    expect(getFeatureTypeTabsMask(false, true)).toBe(
      'linear-gradient(to right, #000, #000 calc(100% - 96px), transparent)'
    );
  });

  it('fades both ends while tabs extend past each', () => {
    expect(getFeatureTypeTabsMask(true, true)).toBe(
      'linear-gradient(to right, transparent, #000 96px, #000 calc(100% - 96px), transparent)'
    );
  });
});
