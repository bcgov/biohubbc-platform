import { IDBConnection } from '../database/db';
import { ISystemConstant, SystemConstantRepository } from '../repositories/system-constant';
import { DBService } from './db-service';

export class SystemConstantService extends DBService {
  systemConstantRepository: SystemConstantRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.systemConstantRepository = new SystemConstantRepository(connection);
  }

  async getSystemConstant(constantName: string): Promise<ISystemConstant> {
    return this.systemConstantRepository.getSystemConstant(constantName);
  }

  async getSystemConstants(constantNames: string[]): Promise<ISystemConstant[]> {
    return this.systemConstantRepository.getSystemConstants(constantNames);
  }
}
