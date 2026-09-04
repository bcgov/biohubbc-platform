import { expect } from 'chai';
import { describe } from 'mocha';
import { getMartinConfig } from './martin-config';

describe('getMartinConfig', () => {
  const VARIABLES = ['MARTIN_TOKEN_TTL_SECONDS', 'MARTIN_CONTEXT_TTL_SECONDS', 'MARTIN_CONTEXT_MAX_LIVE'] as const;

  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(VARIABLES.map((name) => [name, process.env[name]]));

    for (const name of VARIABLES) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of VARIABLES) {
      if (originalEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnv[name];
      }
    }
  });

  it('falls back to the defaults when nothing is set', () => {
    expect(getMartinConfig()).to.deep.equal({
      tokenTtlSeconds: 900,
      contextTtlSeconds: 1800,
      maxLiveContexts: 200
    });
  });

  it('reads each value from the environment', () => {
    process.env.MARTIN_TOKEN_TTL_SECONDS = '300';
    process.env.MARTIN_CONTEXT_TTL_SECONDS = '600';
    process.env.MARTIN_CONTEXT_MAX_LIVE = '50';

    expect(getMartinConfig()).to.deep.equal({
      tokenTtlSeconds: 300,
      contextTtlSeconds: 600,
      maxLiveContexts: 50
    });
  });

  for (const name of ['MARTIN_TOKEN_TTL_SECONDS', 'MARTIN_CONTEXT_TTL_SECONDS', 'MARTIN_CONTEXT_MAX_LIVE'] as const) {
    describe(name, () => {
      // A value that is present but unusable throws rather than falling back, so a deployment typo
      // cannot leave the service running with settings nobody chose.
      for (const value of ['not-a-number', '0', '-1', '90.5']) {
        it(`rejects ${value}`, () => {
          process.env[name] = value;

          expect(() => getMartinConfig()).to.throw(`${name} must be a positive whole number`);
        });
      }
    });
  }

  it('rejects a context lifetime shorter than the token lifetime', () => {
    // A session stops re-minting once it holds a token, so a token outliving its context would go
    // on verifying against tiles the database has stopped generating.
    process.env.MARTIN_TOKEN_TTL_SECONDS = '900';
    process.env.MARTIN_CONTEXT_TTL_SECONDS = '60';

    expect(() => getMartinConfig()).to.throw(
      'MARTIN_CONTEXT_TTL_SECONDS (60) must be greater than or equal to MARTIN_TOKEN_TTL_SECONDS (900)'
    );
  });

  it('accepts a context lifetime equal to the token lifetime', () => {
    process.env.MARTIN_TOKEN_TTL_SECONDS = '900';
    process.env.MARTIN_CONTEXT_TTL_SECONDS = '900';

    expect(getMartinConfig().contextTtlSeconds).to.equal(900);
  });
});
