import { expect } from 'chai';
import { describe } from 'mocha';
import { getPgBossConfig } from './pg-boss-config';

describe('pg-boss-config', () => {
  describe('getPgBossConfig', () => {
    it('returns config with database connection settings from environment variables', () => {
      const config = getPgBossConfig();

      expect(config.host).to.equal(process.env.DB_HOST);
      expect(config.port).to.equal(Number(process.env.DB_PORT) || 5432);
      expect(config.database).to.equal(process.env.DB_DATABASE);
      expect(config.user).to.equal(process.env.DB_USER_API);
      expect(config.password).to.equal(process.env.DB_USER_API_PASS);
    });

    it('returns config with pgboss schema', () => {
      const config = getPgBossConfig();

      expect(config.schema).to.equal('pgboss');
    });

    it('returns config with 30-second monitor interval', () => {
      const config = getPgBossConfig();

      expect(config.monitorIntervalSeconds).to.equal(30);
    });

    it('defaults port to 5432 when DB_PORT is not set', () => {
      const originalDbPort = process.env.DB_PORT;
      delete process.env.DB_PORT;

      const config = getPgBossConfig();

      expect(config.port).to.equal(5432);

      process.env.DB_PORT = originalDbPort;
    });
  });
});
