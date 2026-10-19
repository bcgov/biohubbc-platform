import { getContrastRatio } from '@mui/material/styles';
import { TAG_TEXT_COLOR_DARK, TAG_TEXT_COLOR_LIGHT } from 'constants/tag';

/**
 * Picks black or white text, whichever contrasts more with a background. Ties take black text.
 *
 * @param {string} backgroundColor The background, `#RRGGBB`.
 * @returns {string} `#000000` or `#FFFFFF`.
 */
export const getContrastTextColor = (backgroundColor: string): string => {
  if (
    getContrastRatio(backgroundColor, TAG_TEXT_COLOR_DARK) >= getContrastRatio(backgroundColor, TAG_TEXT_COLOR_LIGHT)
  ) {
    return TAG_TEXT_COLOR_DARK;
  }

  return TAG_TEXT_COLOR_LIGHT;
};
