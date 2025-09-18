import { IDBConnection } from '../database/db';
import { CodesetFilters, CreateCodeset, GetCodeset } from '../paths/codeset/index.interface';
import { ContributorCodesetRepository } from '../repositories/contributor-codeset-repository';
import { DBService } from './db-service';

export class ContributorCodesetService extends DBService {
  contributorCodesetRepository: ContributorCodesetRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorCodesetRepository = new ContributorCodesetRepository(connection);
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
    // Get existing codeset categories for the contributor
    const { categories } = await this.contributorCodesetRepository.getCodesets({
      contributor_id: codeset.contributor_id
    });

    // Get the set of unique categories
    const existingCategoryNames = new Set(categories.map((category) => category.name));

    console.log(codeset, '@CODESET');

    // Find the new categories that don't exist in the set
    const newCategories = codeset.categories.filter((category) => !existingCategoryNames.has(category.name));

    // Add the new categories, if there are any
    if (newCategories.length > 0) {
      await Promise.all(
        newCategories.map((category) =>
          this.contributorCodesetRepository.createCodesetCategory(codeset.contributor_id, category)
        )
      );
    }
  }
}
