import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { IFormFilters } from 'interfaces/useFormsApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Key prefix of every form query.
 *
 * @returns The form key prefix.
 */
const all = () => [QUERY_KEY_ROOT.FORM] as const;

/**
 * Key of one page of the form list.
 *
 * @param {IFormFilters} filters The keyword sent.
 * @param {ApiPaginationRequestOptions} pagination The page and sort sent.
 * @returns The form list key.
 */
const list = (filters: IFormFilters, pagination: ApiPaginationRequestOptions) =>
  [...all(), 'list', filters, pagination] as const;

/**
 * Key of one form version's layout.
 *
 * @param {number} formId The owning form.
 * @param {number} formVersionId The form version.
 * @returns The form version key.
 */
const version = (formId: number, formVersionId: number) => [...all(), 'version', formId, formVersionId] as const;

/**
 * Key of the teams linked to one form.
 *
 * @param {number} formId The form.
 * @returns The form teams key.
 */
const teams = (formId: number) => [...all(), 'teams', formId] as const;

/**
 * Key of the published form addressed by a slug.
 *
 * @param {string} formSlug The form slug.
 * @returns The published form key.
 */
const slug = (formSlug: string) => [...all(), 'slug', formSlug] as const;

/**
 * Key of one page of a form's codesets.
 *
 * @param {string} formSlug The form slug.
 * @param {ApiPaginationRequestOptions} pagination The page and sort sent.
 * @returns The form codesets key.
 */
const codesets = (formSlug: string, pagination: ApiPaginationRequestOptions) =>
  [...all(), 'codesets', formSlug, pagination] as const;

/**
 * Key of one page of the codes of one of a form's codesets.
 *
 * @param {string} formSlug The form slug.
 * @param {number} contributorCodesetId The codeset.
 * @param {ApiPaginationRequestOptions} pagination The page and sort sent.
 * @returns The codeset codes key.
 */
const codes = (formSlug: string, contributorCodesetId: number, pagination: ApiPaginationRequestOptions) =>
  [...all(), 'codes', formSlug, contributorCodesetId, pagination] as const;

/**
 * Key prefix of every query of one form's submissions.
 *
 * @param {string} formSlug The form slug.
 * @returns The form submissions key prefix.
 */
const submissions = (formSlug: string) => [...all(), 'submissions', formSlug] as const;

/**
 * Key of one page of a form's submissions.
 *
 * @param {string} formSlug The form slug.
 * @param {ApiPaginationRequestOptions} pagination The page and sort sent.
 * @returns The form submission list key.
 */
const submissionList = (formSlug: string, pagination: ApiPaginationRequestOptions) =>
  [...submissions(formSlug), 'list', pagination] as const;

/**
 * Key of one form submission.
 *
 * @param {string} formSlug The form slug.
 * @param {string} formSubmissionUuid The form submission.
 * @returns The form submission key.
 */
const submission = (formSlug: string, formSubmissionUuid: string) =>
  [...submissions(formSlug), 'detail', formSubmissionUuid] as const;

export const formQueryKeys = {
  all,
  list,
  version,
  teams,
  slug,
  codesets,
  codes,
  submissions,
  submissionList,
  submission
};
