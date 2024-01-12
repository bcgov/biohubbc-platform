import { IDBConnection } from '../database/db';

/**
 * Base class for services that require a database connection.
 *
 * @export
 * @class DBService
 */
export class DBService {
  connection: IDBConnection;

  serviceCache: Map<any, any> = new Map();

  constructor(connection: IDBConnection) {
    this.connection = connection;
  }

  /**
   * Returns an instance of the specified service.
   *
   * @template ClassType
   * @param {{ new (connection: IDBConnection): ClassType }} className
   * @return {*}  {ClassType} An instance of `ClassType`
   * @memberof DBService
   */
  getService<ClassType extends DBService>(className: { new (connection: IDBConnection): ClassType }): ClassType {
    if (!this.serviceCache.has(className)) {
      const instance = new className(this.connection);

      this.serviceCache.set(className, instance);

      return instance;
    }

    return this.serviceCache.get(className);
  }
}
