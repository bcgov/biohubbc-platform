import { getContrastTextColor } from './color';

describe('getContrastTextColor', () => {
  it('uses white text on dark backgrounds', () => {
    expect(getContrastTextColor('#000000')).toBe('#FFFFFF');
    expect(getContrastTextColor('#1A5A96')).toBe('#FFFFFF');
  });

  it('uses black text on light backgrounds', () => {
    expect(getContrastTextColor('#FFFFFF')).toBe('#000000');
    expect(getContrastTextColor('#FCBA19')).toBe('#000000');
  });

  it('uses whichever text contrasts more with a mid-tone background', () => {
    expect(getContrastTextColor('#757575')).toBe('#FFFFFF');
    expect(getContrastTextColor('#767676')).toBe('#000000');
  });
});
