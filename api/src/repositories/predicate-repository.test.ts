import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiGeneralError, ApiNotFoundError } from '../errors/api-error';
import { PredicateRepository } from './predicate-repository';

const predicateRow = {
  predicate_id: 'pred-1',
  feature_property_id: 11,
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
      const knexStub = sinon.stub().resolves(mockQueryResult([{ ...predicateRow, inserted: true }], 1));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertPredicateAnchor({
        feature_property_id: 11,
        feature_type_property_id: 22,
        feature_property_type_id: 3,
        predicate_hash: 'hash-1'
      });

      expect(result).to.eql({ ...predicateRow, inserted: true });
      expect(knexStub.callCount).to.equal(1);
      expect(knexStub.firstCall.args[0].toString()).to.not.include('ON CONFLICT');
    });
  });

  describe('findPredicateByHash', () => {
    it('returns active predicate by hash', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([predicateRow], 1));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.findPredicateByHash('hash-1');
      expect(result).to.eql(predicateRow);
    });

    it('returns null when missing', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.findPredicateByHash('hash-1');
      expect(result).to.equal(null);
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

    it('inserts split timestamp payloads', async () => {
      const cases = [
        { value: { date_value: '2024-01-01', time_value: null }, bindings: ['2024-01-01', 'After', 'pred-1', null] },
        {
          value: { date_value: null, time_value: '14:30:00-07:00' },
          bindings: [null, 'After', 'pred-1', '14:30:00-07:00']
        },
        {
          value: { date_value: '2024-01-01', time_value: '14:30:00-07:00' },
          bindings: ['2024-01-01', 'After', 'pred-1', '14:30:00-07:00']
        }
      ];

      for (const testCase of cases) {
        const knexStub = sinon.stub().resolves(mockQueryResult([], 1));
        const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

        await repository.writePredicatePayload('pred-1', {
          type: 'timestamp',
          operator: 'After',
          value: testCase.value
        });

        expect(knexStub.firstCall.args[0].toSQL().bindings).to.eql(testCase.bindings);
      }
    });

    it('inserts null timestamp parts for Exists', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      await repository.writePredicatePayload('pred-1', {
        type: 'timestamp',
        operator: 'Exists'
      });

      expect(knexStub.firstCall.args[0].toSQL().bindings).to.eql([null, 'Exists', 'pred-1', null]);
    });

    it('throws when timestamp payload value is missing for a comparison operator', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.writePredicatePayload('pred-1', {
          type: 'timestamp',
          operator: 'After'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiGeneralError);
      }
    });

    it('throws when taxon payload value is missing for a comparison operator', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new PredicateRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.writePredicatePayload('pred-1', {
          type: 'taxon',
          operator: 'Equals'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiGeneralError);
        expect(knexStub).to.not.have.been.called;
      }
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
                feature_property_id: 11,
                feature_type_property_id: 22,
                operator: 'Equals',
                value: 'elk'
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
          feature_property_id: 11,
          feature_type_property_id: 22,
          operator: 'Equals',
          value: 'elk'
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
                feature_property_id: 11,
                feature_type_property_id: 1,
                operator: 'Contains',
                value: 'elk'
              }
            },
            {
              predicate_id: 'pred-2',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_property_id: 12,
                feature_type_property_id: 2,
                operator: 'GreaterThan',
                value: 12.5
              }
            },
            {
              predicate_id: 'pred-3',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_property_id: 13,
                feature_type_property_id: 3,
                operator: 'Equals',
                value: true
              }
            },
            {
              predicate_id: 'pred-4',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_property_id: 14,
                feature_type_property_id: 4,
                operator: 'Before',
                value: '2024-01-01'
              }
            },
            {
              predicate_id: 'pred-5',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_property_id: 15,
                feature_type_property_id: 5,
                operator: 'DescendsFrom',
                value: 123
              }
            },
            {
              predicate_id: 'pred-6',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_property_id: 16,
                feature_type_property_id: 6,
                operator: 'Intersects',
                value: {
                  type: 'FeatureCollection',
                  features: []
                }
              }
            },
            {
              predicate_id: 'pred-7',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_property_id: 17,
                feature_type_property_id: 7,
                operator: 'Equals',
                value: 42
              }
            },
            {
              predicate_id: 'pred-8',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_property_id: 18,
                feature_type_property_id: 8,
                operator: 'Exists'
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
            feature_property_id: 11,
            feature_type_property_id: 1,
            operator: 'Contains',
            value: 'elk'
          }
        },
        {
          predicate_id: 'pred-2',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_property_id: 12,
            feature_type_property_id: 2,
            operator: 'GreaterThan',
            value: 12.5
          }
        },
        {
          predicate_id: 'pred-3',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_property_id: 13,
            feature_type_property_id: 3,
            operator: 'Equals',
            value: true
          }
        },
        {
          predicate_id: 'pred-4',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_property_id: 14,
            feature_type_property_id: 4,
            operator: 'Before',
            value: '2024-01-01'
          }
        },
        {
          predicate_id: 'pred-5',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_property_id: 15,
            feature_type_property_id: 5,
            operator: 'DescendsFrom',
            value: 123
          }
        },
        {
          predicate_id: 'pred-6',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_property_id: 16,
            feature_type_property_id: 6,
            operator: 'Intersects',
            value: { type: 'FeatureCollection', features: [] }
          }
        },
        {
          predicate_id: 'pred-7',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_property_id: 17,
            feature_type_property_id: 7,
            operator: 'Equals',
            value: 42
          }
        },
        {
          predicate_id: 'pred-8',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_property_id: 18,
            feature_type_property_id: 8,
            operator: 'Exists'
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
                feature_property_id: 12,
                feature_type_property_id: 33,
                operator: 'Equals',
                value: 'wolf'
              }
            },
            {
              predicate_id: 'pred-1',
              payload_count: 1,
              predicate_node: {
                type: 'predicate',
                feature_property_id: 11,
                feature_type_property_id: 22,
                operator: 'Equals',
                value: 'elk'
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
            feature_property_id: 11,
            feature_type_property_id: 22,
            operator: 'Equals',
            value: 'elk'
          }
        },
        {
          predicate_id: 'pred-2',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_property_id: 12,
            feature_type_property_id: 33,
            operator: 'Equals',
            value: 'wolf'
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
                feature_property_id: 11,
                feature_type_property_id: 22,
                operator: 'Equals',
                value: 'elk'
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
