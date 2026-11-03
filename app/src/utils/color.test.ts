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

  it('uses white text on bold mid-tone backgrounds where it reads as bold text, though black contrasts more', () => {
    expect(getContrastTextColor('#5A9E94')).toBe('#FFFFFF');
    expect(getContrastTextColor('#1E90FF')).toBe('#FFFFFF');
    expect(getContrastTextColor('#767676')).toBe('#FFFFFF');
  });

  it('uses black text once white falls below the bold text contrast minimum', () => {
    expect(getContrastTextColor('#999999')).toBe('#000000');
  });
});
