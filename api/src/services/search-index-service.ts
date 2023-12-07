import { IDBConnection } from "../database/db";
import { SearchIndexRepository } from "../repositories/search-index-respository";
import { SubmissionRepository } from "../repositories/submission-repository";
import { getLogger } from "../utils/logger";
import { DBService } from "./db-service";

const defaultLog = getLogger('services/search-index-service');

export class SearchIndexService extends DBService {
  searchIndexRepository: SearchIndexRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.searchIndexRepository = new SearchIndexRepository(connection);
  }

  async indexFeaturesBySubmissionId(submissionId: number): Promise<void> {
    const submissionService = new SubmissionRepository(this.connection);
    const features = await submissionService.getFeatureRecordsBySubmissionId(submissionId);

    const featureData = features.map((feature) => feature.data);
    defaultLog.debug({ label: 'indexFeaturesBySubmissionId', featureData });
  }
}
