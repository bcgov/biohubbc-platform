export interface CodeReference {
  slug: string;
  contributorCodesetKey: string;
  contributorCodesetCodeKey: string;
}

/**
 * Parse a code reference slug from payload values.
 *
 * Accepted format: `code::<contributor-codeset-key>::<contributor-codeset-code-key>`.
 *
 * @param {string} value
 * @return {( | null)}
 */
export const parseCodeReference = (value: string): CodeReference | null => {
  const split = value.trim().split('::');

  if (split.length !== 3 || split[0] !== 'code') {
    return null;
  }

  const contributorCodesetKey = split[1].trim();
  const contributorCodesetCodeKey = split[2].trim();

  if (!contributorCodesetKey || !contributorCodesetCodeKey) {
    return null;
  }

  return {
    slug: `code::${contributorCodesetKey}::${contributorCodesetCodeKey}`,
    contributorCodesetKey,
    contributorCodesetCodeKey
  };
};
