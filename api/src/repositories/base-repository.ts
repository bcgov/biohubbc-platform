import { SYSTEM_ROLE } from '../constants/roles';
import { IDBConnection } from '../database/db';
import { UserService } from '../services/user-service';

/**
 * Base class for repositories.
 *
 * @export
 * @class BaseRepository
 */
export class BaseRepository {
  connection: IDBConnection;

  constructor(connection: IDBConnection) {
    this.connection = connection;
  }

  async isAdmin(id: number): Promise<boolean> {
    const userService = new UserService(this.connection);
    const userObject = await userService.getUserById(id);
    return [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR].some((systemRole) =>
      userObject.role_names.includes(systemRole)
    );
  }
}
