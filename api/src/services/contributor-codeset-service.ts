import { IDBConnection } from '../database/db';
import { CodesetFilters, CreateCodeset, GetCodeset } from '../paths/codeset/index.interface';
import { ContributorCodesetRepository } from '../repositories/contributor-codeset-repository';
import { ContributorService } from './contributor-service';
import { DBService } from './db-service';

export class ContributorCodesetService extends DBService {
  contributorCodesetRepository: ContributorCodesetRepository;
  contributorService: ContributorService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorCodesetRepository = new ContributorCodesetRepository(connection);
    this.contributorService = new ContributorService(connection);
  }

  /**
   * Get codesets with optional filters
   *
   * @param {CodesetFilters} filters
   * @returns {Promise<GetCodeset>}
   */
  async getCodeset(filters?: CodesetFilters): Promise<GetCodeset> {
    return this.contributorCodesetRepository.getCodesets(filters);
  }

  /**
   * Add new codes for contributing systems. This does not currently delete or soft delete old codes.
   *
   * @param {CreateCodeset} codeset - The contributor codeset data
   * @returns {Promise<void>}
   * @memberof ContributorCodesetService
   */
  async upsertCodeset(codeset: CreateCodeset): Promise<void> {
    // Step 1: Get contributor ID
    const { contributor_id } = await this.contributorService.getContributorByClientId(codeset.clientId);

    // Step 2: Fetch existing categories and their codes
    const { categories: existingCategoriesInDb } = await this.contributorCodesetRepository.getCodesets({
      contributor_id
    });

    // Map of existing categories: name -> category
    const existingCategoryMap = new Map(existingCategoriesInDb.map((cat) => [cat.name, cat]));

    // Separate new and existing categories
    const newCategories = codeset.categories.filter((cat) => !existingCategoryMap.has(cat.name));
    const existingCategories = codeset.categories.filter((cat) => existingCategoryMap.has(cat.name));

    // Step 3: Insert new categories (and their codes)
    if (newCategories.length > 0) {
      await Promise.all(
        newCategories.map((category) =>
          this.contributorCodesetRepository.createCodesetCategory(contributor_id, category)
        )
      );
    }

    // Step 4: For existing categories, batch insert only new codes (concurrently)
    const promises = existingCategories.map((category) => {
      const existingCategory = existingCategoryMap.get(category.name);

      // Return early if
      if (!existingCategory) {
        return;
      }

      const existingCodeValues = new Set(existingCategory.codes.map((c) => c.value));
      const newCodes = category.codes.filter((code) => !existingCodeValues.has(code.value));

      return this.contributorCodesetRepository.createCodeForCategory(
        existingCategory.contributor_code_category_id,
        newCodes
      );
    });

    await Promise.all(promises);
  }
}
