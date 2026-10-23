import { getContrastRatio } from '@mui/material/styles';
import { TAG_TEXT_COLOR_DARK, TAG_TEXT_COLOR_LIGHT, TAG_TEXT_COLOR_LIGHT_MIN_CONTRAST } from 'constants/tag';

/**
 * Picks white text on any background it reads on as bold text, at the WCAG minimum contrast for bold text, and black
 * text on lighter backgrounds. Mid-tone and saturated colors take white text even where black would contrast more,
 * since white reads as intended on a bold color.
 *
 * @param {string} backgroundColor The background, `#RRGGBB`.
 * @returns {string} `#000000` or `#FFFFFF`.
 */
export const getContrastTextColor = (backgroundColor: string): string => {
  if (getContrastRatio(backgroundColor, TAG_TEXT_COLOR_LIGHT) >= TAG_TEXT_COLOR_LIGHT_MIN_CONTRAST) {
    return TAG_TEXT_COLOR_LIGHT;
  }

  return TAG_TEXT_COLOR_DARK;
};
