import { IDBConnection } from '../database/db';
import { ESService } from './es-service';

/**
 * Base class for services that require a database connection.
 *
 * @export
 * @class DBService
 */
export class DBService extends ESService {

  connection: IDBConnection;

  constructor(connection: IDBConnection) {
    super();
    this.connection = connection;
  }
}
