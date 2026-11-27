import { FormSubmissionValue, IFormSection, IFormSubmissionData } from 'interfaces/useFormsApi.interface';

/**
 * The parts of a form submission. Each matches a part of a submission tarball: features, codesets and files.
 */
export type FormSubmissionTab = 'form' | 'codes' | 'files';

/**
 * One row of a form section: one feature, with a value per field keyed by property. The source identifier is kept
 * across saves and revisions, so a resubmitted row reconciles against the feature it produced before.
 */
export interface IFormSubmissionRow {
  sourceId: string;
  values: Record<string, FormSubmissionValue>;
}

/**
 * Build an empty row with a new source identifier.
 *
 * @returns {IFormSubmissionRow} Row with no values.
 */
export const createFormSubmissionRow = (): IFormSubmissionRow => ({ sourceId: crypto.randomUUID(), values: {} });

/**
 * Build the rows of every section from a saved draft, or, without one, one empty row for each required section.
 *
 * @param {IFormSection[]} sections Published form sections.
 * @param {IFormSubmissionData | null} data Saved draft, if any.
 * @returns {Record<number, IFormSubmissionRow[]>} Rows keyed by feature type.
 */
export const toFormSubmissionRows = (
  sections: IFormSection[],
  data: IFormSubmissionData | null
): Record<number, IFormSubmissionRow[]> =>
  Object.fromEntries(
    sections.map((section) => {
      if (data) {
        const sectionData = data.sections.find((item) => item.featureTypeId === section.feature_type_id);
        return [section.feature_type_id, sectionData?.rows ?? []];
      }

      return [section.feature_type_id, section.required_value ? [createFormSubmissionRow()] : []];
    })
  );

/**
 * Build the draft document from the rows of every section, in section order.
 *
 * @param {IFormSection[]} sections Published form sections.
 * @param {Record<number, IFormSubmissionRow[]>} rowsByFeatureTypeId Rows keyed by feature type.
 * @returns {IFormSubmissionData} Draft document.
 */
export const toFormSubmissionData = (
  sections: IFormSection[],
  rowsByFeatureTypeId: Record<number, IFormSubmissionRow[]>
): IFormSubmissionData => ({
  sections: sections.map((section) => ({
    featureTypeId: section.feature_type_id,
    rows: rowsByFeatureTypeId[section.feature_type_id] ?? []
  }))
});

/**
 * Build the stored value of a code: `code::<codeset key>::<code key>`, as ingestion resolves it.
 *
 * @param {string} codesetKey Key of the codeset.
 * @param {string} codeKey Key of the code.
 * @returns {string} Code value.
 */
export const toCodeValue = (codesetKey: string, codeKey: string): string => `code::${codesetKey}::${codeKey}`;
