/** Color a new tag starts with. */
export const TAG_DEFAULT_COLOR = '#1A5A96';

/** Six hex digits, `RRGGBB`: a tag color as the tag form's color field holds it, without the leading `#`. */
export const HEX_COLOR_DIGITS_PATTERN = /^[0-9A-Fa-f]{6}$/;

/** Text color for a tag chip on a light background. */
export const TAG_TEXT_COLOR_DARK = '#000000';

/** Text color for a tag chip on a dark background. */
export const TAG_TEXT_COLOR_LIGHT = '#FFFFFF';

/** Contrast with its background at which a tag chip's bold text is white: the WCAG minimum for bold text. */
export const TAG_TEXT_COLOR_LIGHT_MIN_CONTRAST = 3;

/** Number of matching tags a tag picker offers for each search. */
export const TAG_SEARCH_LIMIT = 50;
