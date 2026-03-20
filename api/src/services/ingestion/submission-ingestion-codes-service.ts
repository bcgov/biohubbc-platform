import { IFlattenedBlock } from '../../models/submission-feature';
import { CodeReference, parseCodeReference } from '../../utils/code-reference';

/**
 * Service for extracting code slug references from flattened submission blocks.
 *
 * @export
 * @class SubmissionIngestionCodesService
 */
export class SubmissionIngestionCodesService {
  /**
   * Get unique code references from all block properties.
   *
   * @param {IFlattenedBlock[]} blocks
   * @return {CodeReference[]}
   * @memberof SubmissionIngestionCodesService
   */
  getUniqueCodeReferencesFromBlocks(blocks: IFlattenedBlock[]): CodeReference[] {
    const codeReferencesBySlug = new Map<string, CodeReference>();

    for (const block of blocks) {
      this.addCodeReferencesFromProperties(block.properties, codeReferencesBySlug);
    }

    return [...codeReferencesBySlug.values()];
  }

  /**
   * Add code references found in a feature properties object. Iterates through properties.
   *
   * @private
   * @param {Record<string, unknown>} properties
   * @param {Map<string, CodeReference>} codeReferencesBySlug
   * @memberof SubmissionIngestionCodesService
   */
  private addCodeReferencesFromProperties(
    properties: Record<string, unknown>,
    codeReferencesBySlug: Map<string, CodeReference>
  ): void {
    for (const propertyValue of Object.values(properties)) {
      this.addCodeReferencesFromValue(propertyValue as string | string[], codeReferencesBySlug);
    }
  }

  /**
   * Add code references found in a property value.
   *
   * Supports single string values and arrays of values.
   *
   * @private
   * @param {(string | string[])} propertyValue
   * @param {Map<string, CodeReference>} codeReferencesBySlug
   * @memberof SubmissionIngestionCodesService
   */
  private addCodeReferencesFromValue(
    propertyValue: string | string[],
    codeReferencesBySlug: Map<string, CodeReference>
  ): void {
    if (Array.isArray(propertyValue)) {
      for (const value of propertyValue) {
        this.addSingleCodeReference(value, codeReferencesBySlug);
      }

      return;
    }

    this.addSingleCodeReference(propertyValue, codeReferencesBySlug);
  }

  /**
   * Parse and add a single code slug value if valid.
   *
   * @private
   * @param {string} codeSlug
   * @param {Map<string, CodeReference>} codeReferencesBySlug
   * @memberof SubmissionIngestionCodesService
   */
  private addSingleCodeReference(codeSlug: string, codeReferencesBySlug: Map<string, CodeReference>): void {
    const parsedCodeReference = parseCodeReference(codeSlug);

    if (!parsedCodeReference) {
      return;
    }

    codeReferencesBySlug.set(parsedCodeReference.slug, parsedCodeReference);
  }
}
