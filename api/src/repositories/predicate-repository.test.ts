import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { PredicateRepository } from './predicate-repository';

const predicateRow = {
  predicate_id: 'pred-1',
  feature_type_property_id: 22,
  feature_property_type_id: 3,
  predicate_hash: 'hash-1'
};

describe('PredicateRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertPredicateAnchor', () => {
    it('returns inserted predicate row when a predicate anchor is created', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([predicateRow], 1));
      const repository = new PredicateRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.insertPredicateAnchor({
        feature_type_property_id: 22,
        feature_property_type_name: FEATURE_PROPERTY_TYPE.STRING,
        predicate_hash: 'hash-1'
      });

      expect(result).to.eql(predicateRow);
      expect(sqlStub.callCount).to.equal(1);
    });

    it('returns undefined on conflict', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PredicateRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.insertPredicateAnchor({
        feature_type_property_id: 22,
        feature_property_type_name: FEATURE_PROPERTY_TYPE.STRING,
        predicate_hash: 'hash-1'
      });

      expect(result).to.equal(undefined);
      expect(sqlStub.callCount).to.equal(1);
    });
  });

  describe('getPredicateByHash', () => {
    it('returns active predicate by hash', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([predicateRow], 1));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getPredicateByHash('hash-1');
      expect(result).to.eql(predicateRow);
    });

    it('returns undefined when missing', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getPredicateByHash('hash-1');
      expect(result).to.equal(undefined);
    });
  });

  describe('getPredicatesByHashes', () => {
    it('returns active predicate rows for provided hashes', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([predicateRow], 1));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getPredicatesByHashes(['hash-1', 'hash-1']);
      expect(result).to.eql([predicateRow]);
      expect(knexStub.callCount).to.equal(1);
    });
  });

  describe('writePredicatePayload', () => {
    it('inserts typed string payload', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      await repository.writePredicatePayload('pred-1', {
        type: 'string',
        operator: 'Equals',
        value: 'elk'
      });

      expect(knexStub.callCount).to.equal(1);
    });

    it('inserts typed geometry payload', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      await repository.writePredicatePayload('pred-1', {
        type: 'geometry',
        operator: 'Intersects',
        value: {
          type: 'FeatureCollection',
          features: []
        }
      });

      expect(knexStub.callCount).to.equal(1);
    });

    it('throws when insert row count is unexpected', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.writePredicatePayload('pred-1', {
          type: 'boolean',
          operator: 'Equals',
          value: true
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('readPredicateNode', () => {
    it('reads a single predicate read-row from SQL JSON shape', async () => {
      const knexStub = sinon.stub().resolves(
        mockQueryResult(
          [
            {
              predicate_id: 'pred-1',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 22,
                predicate: { type: 'string', operator: 'Equals', value: 'elk' }
              }
            }
          ],
          1
        )
      );
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.readPredicateNode('pred-1');

      expect(result).to.eql({
        predicate_id: 'pred-1',
        payload_count: 1,
        predicate_node: {
          type: 'predicate',
          feature_type_property_id: 22,
          predicate: { type: 'string', operator: 'Equals', value: 'elk' }
        }
      });
    });

    it('reads all typed predicate read-rows returned by query JSON', async () => {
      const knexStub = sinon.stub().resolves(
        mockQueryResult(
          [
            {
              predicate_id: 'pred-1',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 1,
                predicate: { type: 'string', operator: 'Contains', value: 'elk' }
              }
            },
            {
              predicate_id: 'pred-2',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 2,
                predicate: { type: 'number', operator: 'GreaterThan', value: 12.5 }
              }
            },
            {
              predicate_id: 'pred-3',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 3,
                predicate: { type: 'boolean', operator: 'Equals', value: true }
              }
            },
            {
              predicate_id: 'pred-4',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 4,
                predicate: {
                  type: 'timestamp',
                  operator: 'Before',
                  value: { date_value: '2024-01-01' }
                }
              }
            },
            {
              predicate_id: 'pred-5',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 5,
                predicate: { type: 'taxon', operator: 'DescendsFrom', value: 123 }
              }
            },
            {
              predicate_id: 'pred-6',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 6,
                predicate: {
                  type: 'geometry',
                  operator: 'Intersects',
                  value: {
                    type: 'FeatureCollection',
                    features: []
                  }
                }
              }
            },
            {
              predicate_id: 'pred-7',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 7,
                predicate: { type: 'code', operator: 'Equals', value: 42 }
              }
            },
            {
              predicate_id: 'pred-8',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 8,
                predicate: { type: 'string', operator: 'Exists' }
              }
            }
          ],
          8
        )
      );
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.readPredicateNodes([
        'pred-1',
        'pred-2',
        'pred-3',
        'pred-4',
        'pred-5',
        'pred-6',
        'pred-7',
        'pred-8'
      ]);

      expect(result).to.eql([
        {
          predicate_id: 'pred-1',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_type_property_id: 1,
            predicate: { type: 'string', operator: 'Contains', value: 'elk' }
          }
        },
        {
          predicate_id: 'pred-2',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_type_property_id: 2,
            predicate: { type: 'number', operator: 'GreaterThan', value: 12.5 }
          }
        },
        {
          predicate_id: 'pred-3',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_type_property_id: 3,
            predicate: { type: 'boolean', operator: 'Equals', value: true }
          }
        },
        {
          predicate_id: 'pred-4',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_type_property_id: 4,
            predicate: { type: 'timestamp', operator: 'Before', value: { date_value: '2024-01-01' } }
          }
        },
        {
          predicate_id: 'pred-5',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_type_property_id: 5,
            predicate: { type: 'taxon', operator: 'DescendsFrom', value: 123 }
          }
        },
        {
          predicate_id: 'pred-6',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_type_property_id: 6,
            predicate: { type: 'geometry', operator: 'Intersects', value: { type: 'FeatureCollection', features: [] } }
          }
        },
        {
          predicate_id: 'pred-7',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_type_property_id: 7,
            predicate: { type: 'code', operator: 'Equals', value: 42 }
          }
        },
        {
          predicate_id: 'pred-8',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_type_property_id: 8,
            predicate: { type: 'string', operator: 'Exists' }
          }
        }
      ]);
    });

    it('throws not found when read query returns no row', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.readPredicateNode('pred-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('readPredicateNodes', () => {
    it('reads multiple predicates and preserves input order', async () => {
      const knexStub = sinon.stub().resolves(
        mockQueryResult(
          [
            {
              predicate_id: 'pred-2',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 33,
                predicate: { type: 'string', operator: 'Equals', value: 'wolf' }
              }
            },
            {
              predicate_id: 'pred-1',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 22,
                predicate: { type: 'string', operator: 'Equals', value: 'elk' }
              }
            }
          ],
          2
        )
      );
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.readPredicateNodes(['pred-1', 'pred-2']);

      expect(result).to.eql([
        {
          predicate_id: 'pred-1',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_type_property_id: 22,
            predicate: { type: 'string', operator: 'Equals', value: 'elk' }
          }
        },
        {
          predicate_id: 'pred-2',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_type_property_id: 33,
            predicate: { type: 'string', operator: 'Equals', value: 'wolf' }
          }
        }
      ]);
    });

    it('throws not found when one requested predicate is missing', async () => {
      const knexStub = sinon.stub().resolves(
        mockQueryResult(
          [
            {
              predicate_id: 'pred-1',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_type_property_id: 22,
                predicate: { type: 'string', operator: 'Equals', value: 'elk' }
              }
            }
          ],
          1
        )
      );
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.readPredicateNodes(['pred-1', 'pred-2']);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });
});
