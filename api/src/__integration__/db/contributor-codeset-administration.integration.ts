import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiNotFoundError } from '../../errors/api-error';
import { ContributorCodesetCodeService } from '../../services/contributor-codeset-code-service';
import { ContributorCodesetService } from '../../services/contributor-codeset-service';
import { ContributorService } from '../../services/contributor-service';

describe('Contributor codeset administration database integration', () => {
  let connection: IDBConnection;
  let contributorService: ContributorService;
  let contributorCodesetService: ContributorCodesetService;
  let contributorCodesetCodeService: ContributorCodesetCodeService;
  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    contributorService = new ContributorService(connection);
    contributorCodesetService = new ContributorCodesetService(connection);
    contributorCodesetCodeService = new ContributorCodesetCodeService(connection);
  });
  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  it("pages one contributor's code categories, including ended categories", async () => {
    const contributor = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const other = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const active = await contributorCodesetService.createCodeset({
      contributor_id: contributor.contributor_id,
      key: 'a-active',
      label: 'Active',
      external_id: 'v1'
    });
    const ended = await contributorCodesetService.createCodeset({
      contributor_id: contributor.contributor_id,
      key: 'b-ended',
      label: 'Ended',
      external_id: 'v1'
    });
    await contributorCodesetService.createCodeset({
      contributor_id: other.contributor_id,
      key: 'a-active',
      label: 'Other',
      external_id: 'v1'
    });
    await connection.sql(SQL`
      UPDATE contributor_codeset SET record_end_date = now()
      WHERE contributor_codeset_id = ${ended.contributor_codeset_id};
    `);

    const firstPage = await contributorCodesetService.listAdministrativeContributorCodesets(
      contributor.contributor_id,
      {
        page: 1,
        limit: 1
      }
    );
    const secondPage = await contributorCodesetService.listAdministrativeContributorCodesets(
      contributor.contributor_id,
      { page: 2, limit: 1 }
    );

    expect(firstPage.codesets.map((row) => row.contributor_codeset_id)).eql([active.contributor_codeset_id]);
    expect(firstPage.codesets[0].record_end_date).to.be.null;
    expect(secondPage.codesets.map((row) => row.contributor_codeset_id)).eql([ended.contributor_codeset_id]);
    expect(secondPage.codesets[0].record_end_date).not.to.be.null;
    expect(firstPage.pagination.total).equals(2);
  });

  it("pages a code category's values only within the contributor that owns the category", async () => {
    const contributor = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const other = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const codeset = await contributorCodesetService.createCodeset({
      contributor_id: contributor.contributor_id,
      key: 'life-stage',
      label: 'Life stage',
      external_id: 'v1'
    });
    const active = await contributorCodesetCodeService.createContributorCodesetCode({
      contributor_codeset_id: codeset.contributor_codeset_id,
      key: 'adult',
      label: 'Adult',
      external_id: 'v1'
    });
    const ended = await contributorCodesetCodeService.createContributorCodesetCode({
      contributor_codeset_id: codeset.contributor_codeset_id,
      key: 'juvenile',
      label: 'Juvenile',
      external_id: 'v1'
    });
    await connection.sql(SQL`
      UPDATE contributor_codeset_code SET record_end_date = now()
      WHERE contributor_codeset_code_id = ${ended.contributor_codeset_code_id};
    `);

    const owned = await contributorCodesetCodeService.listAdministrativeContributorCodesetCodes(
      { contributorId: contributor.contributor_id, contributorCodesetId: codeset.contributor_codeset_id },
      { page: 1, limit: 10 }
    );
    const notOwned = await contributorCodesetCodeService.listAdministrativeContributorCodesetCodes(
      { contributorId: other.contributor_id, contributorCodesetId: codeset.contributor_codeset_id },
      { page: 1, limit: 10 }
    );

    expect(owned.codes.map((row) => row.contributor_codeset_code_id)).eql([
      active.contributor_codeset_code_id,
      ended.contributor_codeset_code_id
    ]);
    expect(owned.codes.map((row) => row.codeset_label)).eql(['Life stage', 'Life stage']);
    expect(owned.codes[1].record_end_date).not.to.be.null;
    expect(owned.pagination.total).equals(2);
    expect(notOwned.codes).eql([]);
    expect(notOwned.pagination.total).equals(0);
  });

  it('gets a code category only through the contributor that owns it, including an ended category', async () => {
    const contributor = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const other = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const codeset = await contributorCodesetService.createCodeset({
      contributor_id: contributor.contributor_id,
      key: 'life-stage',
      label: 'Life stage',
      external_id: 'v1'
    });
    await connection.sql(SQL`
      UPDATE contributor_codeset SET record_end_date = now()
      WHERE contributor_codeset_id = ${codeset.contributor_codeset_id};
    `);

    const owned = await contributorCodesetService.getAdministrativeContributorCodeset({
      contributorId: contributor.contributor_id,
      contributorCodesetId: codeset.contributor_codeset_id
    });

    expect(owned.label).equals('Life stage');
    expect(owned.record_end_date).not.to.be.null;
    try {
      await contributorCodesetService.getAdministrativeContributorCodeset({
        contributorId: other.contributor_id,
        contributorCodesetId: codeset.contributor_codeset_id
      });
      expect.fail();
    } catch (error) {
      expect(error).instanceOf(ApiNotFoundError);
    }
  });
});
