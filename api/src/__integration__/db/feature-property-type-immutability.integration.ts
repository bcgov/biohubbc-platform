import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';

describe('feature property type immutability (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  async function createFeatureProperty(typeName = 'string'): Promise<{
    feature_property_id: number;
    feature_property_type_id: number;
  }> {
    const result = await connection.sql(SQL`
      INSERT INTO feature_property (
        feature_property_type_id,
        name,
        display_name,
        description,
        calculated_value
      )
      SELECT
        feature_property_type_id,
        ${`immutability_${randomUUID()}`},
        'Immutable property',
        'Created by the feature property type immutability integration test.',
        false
      FROM feature_property_type
      WHERE name = ${typeName}
        AND record_end_date IS NULL
      RETURNING feature_property_id, feature_property_type_id;
    `);

    expect(result.rowCount).to.equal(1);
    return result.rows[0];
  }

  it('restores taxon_id to number storage and removes its taxon-backed rows', async () => {
    const result = await connection.sql(SQL`
      SELECT
        property_type.name AS declared_type,
        (
          SELECT count(*)::integer
          FROM submission_feature_property_taxon taxon_value
          JOIN feature_type_property ftp
            ON ftp.feature_type_property_id = taxon_value.feature_type_property_id
          JOIN feature_property stored_property
            ON stored_property.feature_property_id = ftp.feature_property_id
          WHERE stored_property.name = 'taxon_id'
        ) AS taxon_row_count
      FROM feature_property property
      JOIN feature_property_type property_type
        ON property_type.feature_property_type_id = property.feature_property_type_id
      WHERE property.name = 'taxon_id'
        AND property.record_end_date IS NULL;
    `);

    expect(result.rowCount).to.equal(1);
    expect(result.rows[0]).to.deep.equal({
      declared_type: 'number',
      taxon_row_count: 0
    });
  });

  it('allows the property type to be supplied when creating a feature property', async () => {
    const property = await createFeatureProperty('string');

    expect(property.feature_property_type_id).to.be.a('number');
  });

  it('allows an update that sets the property type to its existing value', async () => {
    const property = await createFeatureProperty('string');

    const result = await connection.sql(SQL`
      UPDATE feature_property
      SET feature_property_type_id = ${property.feature_property_type_id}
      WHERE feature_property_id = ${property.feature_property_id}
      RETURNING feature_property_id;
    `);

    expect(result.rowCount).to.equal(1);
  });

  it('allows supported mutable fields to be updated', async () => {
    const property = await createFeatureProperty('string');

    const result = await connection.sql(SQL`
      UPDATE feature_property
      SET
        name = ${`renamed_${randomUUID()}`},
        display_name = 'Updated property',
        description = 'Updated description',
        calculated_value = true
      WHERE feature_property_id = ${property.feature_property_id}
      RETURNING display_name, description, calculated_value;
    `);

    expect(result.rows[0]).to.deep.equal({
      display_name: 'Updated property',
      description: 'Updated description',
      calculated_value: true
    });
  });

  it('rejects an attempt to change the property type', async () => {
    const property = await createFeatureProperty('string');
    const otherType = await connection.sql(SQL`
      SELECT feature_property_type_id
      FROM feature_property_type
      WHERE name = 'number'
        AND record_end_date IS NULL;
    `);

    try {
      await connection.sql(SQL`
        UPDATE feature_property
        SET feature_property_type_id = ${otherType.rows[0].feature_property_type_id}
        WHERE feature_property_id = ${property.feature_property_id};
      `);
      expect.fail('Expected changing feature_property_type_id to be rejected');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiExecuteSQLError);
      expect(JSON.stringify((error as ApiExecuteSQLError).errors)).to.include(
        'feature_property.feature_property_type_id is immutable'
      );
    }
  });
});
