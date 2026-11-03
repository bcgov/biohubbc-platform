/**
 * The tag color field holds the six hex digits of a color, without the leading `#` that the API stores.
 */

/**
 * Strip every `#` from a color, so a pasted `#1A5A96` becomes the field's `1A5A96`.
 *
 * @param {string} color A color as typed, pasted or stored.
 * @returns {string} The color's hex digits.
 */
export const getTagColorDigits = (color: string): string => color.replaceAll('#', '').trim();

/**
 * The stored color for the field's hex digits.
 *
 * @param {string} colorDigits The color's six hex digits.
 * @returns {string} The color as `#RRGGBB`.
 */
export const getTagColor = (colorDigits: string): string => `#${colorDigits}`;
