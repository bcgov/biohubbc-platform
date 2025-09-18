import { IDBConnection } from '../database/db';
import { CreateCodeset } from '../paths/codeset/index.interface';
import { ContributorCodesetRepository } from '../repositories/contributor-codeset-repository';
import { DBService } from './db-service';

export class ContributorCodesetService extends DBService {
  contributorCodesetRepository: ContributorCodesetRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorCodesetRepository = new ContributorCodesetRepository(connection);
  }

  /**
   * Upsert a contributor codeset, adding new codes and soft deleting old codes
   *
   * @param {number} contributorId
   * @param {CreateCodeset} codeset - The contributor codeset data
   * @returns {Promise<void>}
   * @memberof ContributorCodesetService
   */
  /**
   * Add new codes for contributing systems. This does not currently delete or soft delete old codes.
   *
   * @param {number} contributorId
   * @param {CreateCodeset} codeset - The contributor codeset data
   * @returns {Promise<void>}
   * @memberof ContributorCodesetService
   */
  async upsertCodeset(contributorId: number, codeset: CreateCodeset): Promise<void> {
    // Get existing codeset categories for the contributor
    const { categories: existingCategories } = await this.contributorCodesetRepository.getCodesets({
      contributor_id: contributorId
    });

    // Use the category name as the identifier
    const existingCategoryNames = new Set(existingCategories.map((category) => category.name));

    // Filter new categories that need to be inserted
    const newCategories = codeset.categories.filter((category) => !existingCategoryNames.has(category.name));

    // Process all new categories in parallel if there are any
    if (newCategories.length > 0) {
      await Promise.all(
        newCategories.map((category) =>
          this.contributorCodesetRepository.createCodesetCategory(contributorId, category)
        )
      );
    }
  }
}
