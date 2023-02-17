'use strict';

let process = require('process');

let options = require('pipeline-cli').Util.parseArguments();

// The root config for common values
const config = require('../../.config/config.json');

const name = config.module.queue;
const dbName = config.module.db;

const version = config.version;

const changeId = options.pr;

// A static deployment is when the deployment is updating dev, test, or prod (rather than a temporary PR)
// See `--type=static` in the `deployStatic.yml` git workflow
const isStaticDeployment = options.type === 'static';

const deployChangeId = (isStaticDeployment && 'deploy') || changeId;
const branch = (isStaticDeployment && options.branch) || null;
const tag = (branch && `build-${version}-${changeId}-${branch}`) || `build-${version}-${changeId}`;

const queueDockerfilePath = './Dockerfile.queue';

const processOptions = (options) => {
  const result = { ...options };

  // Check git
  if (!result.git.url.includes('.git')) {
    result.git.url = `${result.git.url}.git`;
  }

  if (!result.git.http_url.includes('.git')) {
    result.git.http_url = `${result.git.http_url}.git`;
  }

  // Fixing repo
  if (result.git.repository.includes('/')) {
    const last = result.git.repository.split('/').pop();
    const final = last.split('.')[0];
    result.git.repository = final;
  }

  return result;
};

options = processOptions(options);

const phases = {
  build: {
    namespace: 'a0ec71-tools',
    name: `${name}`,
    dbName: `${dbName}`,
    phase: 'build',
    changeId: changeId,
    suffix: `-build-${changeId}`,
    instance: `${name}-build-${changeId}`,
    version: `${version}-${changeId}`,
    tag: tag,
    env: 'build',
    s3KeyPrefix: 'platform',
    tz: config.timezone.api,
    branch: branch,
    logLevel: (isStaticDeployment && 'info') || 'debug',
    queueDockerfilePath: queueDockerfilePath
  },
  dev: {
    namespace: 'a0ec71-dev',
    name: `${name}`,
    dbName: `${dbName}`,
    phase: 'dev',
    changeId: deployChangeId,
    suffix: `-dev-${deployChangeId}`,
    instance: `${name}-dev-${deployChangeId}`,
    version: `${deployChangeId}-${changeId}`,
    tag: `dev-${version}-${deployChangeId}`,
    adminHost: 'https://loginproxy.gov.bc.ca/auth',
    env: 'dev',
    s3KeyPrefix: 'platform',
    tz: config.timezone.api,
    sso: config.sso.dev,
    replicas: 1,
    maxReplicas: 1,
    logLevel: (isStaticDeployment && 'info') || 'debug',
    queueDockerfilePath: queueDockerfilePath
  },
  test: {
    namespace: 'a0ec71-test',
    name: `${name}`,
    dbName: `${dbName}`,
    phase: 'test',
    changeId: deployChangeId,
    suffix: `-test`,
    instance: `${name}-test`,
    version: `${version}`,
    tag: `test-${version}`,
    adminHost: 'https://loginproxy.gov.bc.ca/auth',
    env: 'test',
    s3KeyPrefix: 'platform',
    tz: config.timezone.api,
    sso: config.sso.test,
    replicas: 2,
    maxReplicas: 2,
    logLevel: 'info',
    queueDockerfilePath: queueDockerfilePath
  },
  prod: {
    namespace: 'a0ec71-prod',
    name: `${name}`,
    dbName: `${dbName}`,
    phase: 'prod',
    changeId: deployChangeId,
    suffix: `-prod`,
    instance: `${name}-prod`,
    version: `${version}`,
    tag: `prod-${version}`,
    adminHost: 'https://loginproxy.gov.bc.ca/auth',
    env: 'prod',
    s3KeyPrefix: 'platform',
    tz: config.timezone.api,
    sso: config.sso.prod,
    replicas: 2,
    maxReplicas: 2,
    logLevel: 'info',
    queueDockerfilePath: queueDockerfilePath
  }
};

// This callback forces the node process to exit as failure.
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = exports = { phases, options };
