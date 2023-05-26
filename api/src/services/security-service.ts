import { IDBConnection } from '../database/db';
import { PersecutionAndHarmSecurity, SecurityRepository } from '../repositories/security-repository';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';

const defaultLog = getLogger('services/security-service');

/**
 * A service for maintaining securty artifacts.
 *
 * @export
 * @class SecurityService
 */
export class SecurityService extends DBService {
  securityRepository: SecurityRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.securityRepository = new SecurityRepository(connection);
  }

  async getPersecutionAndHarmRules(): Promise<PersecutionAndHarmSecurity[]> {
    defaultLog.debug({ label: 'getPersecutionAndHarmRules' });

    return this.securityRepository.getPersecutionAndHarmRules();
  }
}
