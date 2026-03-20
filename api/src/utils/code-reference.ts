import type { TarCodesets } from '../services/ingestion/submission-ingestion-codes-service.interface';

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
 * @return {(CodeReference | null)}
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

/**
 * Resolve a parsed code reference against loaded contributor codesets.
 *
 * @param {TarCodesets} codesets
 * @param {CodeReference} codeReference
 * @return {unknown}
 */
export const resolveCodeReference = (codesets: TarCodesets, codeReference: CodeReference): unknown => {
  const contributorCodeset = codesets[codeReference.contributorCodesetKey];
  const codes = contributorCodeset?.codes;

  if (!codes) {
    return undefined;
  }

  return codes[codeReference.contributorCodesetCodeKey];
};
