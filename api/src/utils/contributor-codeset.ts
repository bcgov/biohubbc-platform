/**
 * Build a deterministic string slug from ordered identity parts.
 *
 * String-form identities in the contributor codeset flow are always expressed
 * as prefixed slugs: `code::<part1>::<part2>...`.
 *
 * @param {...(string | number | null)} parts - Ordered identity parts to join into a slug.
 * @returns {string} Deterministic contributor code slug.
 */
export const makeSlug = (...parts: Array<string | number | null>): string =>
  `code::${parts.map((part) => (part ?? '').toString()).join('::')}`;

type ContributorCodesetDefinitionLike = {
  external_id?: string | null;
  label: string;
  description?: string | null;
};

/**
 * Compare contributor code metadata definitions.
 *
 * @param {ContributorCodesetDefinitionLike} existing - Existing persisted contributor code definition.
 * @param {ContributorCodesetDefinitionLike} expected - Incoming contributor code definition to compare.
 * @returns {boolean} True when external id, label and description are identical (null-safe).
 */
export const hasSameContributorCodeDefinition = (
  existing: ContributorCodesetDefinitionLike,
  expected: ContributorCodesetDefinitionLike
): boolean =>
  (existing.external_id ?? null) === (expected.external_id ?? null) &&
  existing.label === expected.label &&
  (existing.description ?? null) === (expected.description ?? null);
