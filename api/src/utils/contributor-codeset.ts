/**
 * Build a deterministic string slug from ordered identity parts.
 *
 * String-form identities in the contributor codeset flow are always expressed
 * as prefixed slugs: `code::<part1>::<part2>...`.
 */
export const makeSlug = (...parts: Array<string | number | null>): string =>
  `code::${parts.map((part) => (part ?? '').toString()).join('::')}`;
