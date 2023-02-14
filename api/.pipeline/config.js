'use strict';

let process = require('process');

let options = require('pipeline-cli').Util.parseArguments();

// The root config for common values
const config = require('../../.config/config.json');

const appName = config.module.app;
const name = config.module.api;
const queueName = config.module.queue;
const dbName = config.module.db;

const changeId = options.pr || `${Math.floor(Date.now() * 1000) / 60.0}`; // aka pull-request or branch
const version = config.version || '1.0.0';

// A static deployment is when the deployment is updating dev, test, or prod (rather than a temporary PR)
const isStaticDeployment = options.type === 'static';

const deployChangeId = (isStaticDeployment && 'deploy') || changeId;
const branch = (isStaticDeployment && options.branch) || null;
const tag = (branch && `build-${version}-${changeId}-${branch}`) || `build-${version}-${changeId}`;

const staticUrlsAPI = config.staticUrlsAPI;
const staticUrls = config.staticUrls;

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
    queueName: `${queueName}`,
    dbName: `${dbName}`,
    phase: 'build',
    changeId: changeId,
    suffix: `-build-${changeId}`,
    instance: `${name}-build-${changeId}`,
    version: `${version}-${changeId}`,
    tag: tag,
    env: 'build',
    elasticsearchURL: 'https://elasticsearch-a0ec71-dev.apps.silver.devops.gov.bc.ca',
    elasticsearchEmlIndex: 'eml',
    s3KeyPrefix: 'platform',
    tz: config.timezone.api,
    branch: branch,
    logLevel: (isStaticDeployment && 'info') || 'debug',
    queueDockerfilePath: queueDockerfilePath
  },
  dev: {
    namespace: 'a0ec71-dev',
    name: `${name}`,
    queueName: `${queueName}`,
    dbName: `${dbName}`,
    phase: 'dev',
    changeId: deployChangeId,
    suffix: `-dev-${deployChangeId}`,
    instance: `${name}-dev-${deployChangeId}`,
    version: `${deployChangeId}-${changeId}`,
    tag: `dev-${version}-${deployChangeId}`,
    host: (isStaticDeployment && staticUrlsAPI.dev) || `${name}-${changeId}-a0ec71-dev.apps.silver.devops.gov.bc.ca`,
    appHost: (isStaticDeployment && staticUrls.dev) || `${appName}-${changeId}-a0ec71-dev.apps.silver.devops.gov.bc.ca`,
    adminHost: 'https://loginproxy.gov.bc.ca/auth',
    env: 'dev',
    elasticsearchURL: 'https://elasticsearch-a0ec71-dev.apps.silver.devops.gov.bc.ca',
    elasticsearchEmlIndex: 'eml',
    s3KeyPrefix: 'platform',
    tz: config.timezone.api,
    sso: config.sso.dev,
    replicas: 1,
    maxReplicas: 1,
    queueReplicas: 1,
    queueMaxReplicas: 1,
    logLevel: (isStaticDeployment && 'info') || 'debug',
    queueDockerfilePath: queueDockerfilePath
  },
  test: {
    namespace: 'a0ec71-test',
    name: `${name}`,
    queueName: `${queueName}`,
    dbName: `${dbName}`,
    phase: 'test',
    changeId: deployChangeId,
    suffix: `-test`,
    instance: `${name}-test`,
    version: `${version}`,
    tag: `test-${version}`,
    host: staticUrlsAPI.test,
    appHost: staticUrls.test,
    adminHost: 'https://loginproxy.gov.bc.ca/auth',
    env: 'test',
    elasticsearchURL: 'https://elasticsearch-a0ec71-dev.apps.silver.devops.gov.bc.ca',
    elasticsearchEmlIndex: 'eml',
    s3KeyPrefix: 'platform',
    tz: config.timezone.api,
    sso: config.sso.test,
    replicas: 2,
    maxReplicas: 2,
    queueReplicas: 2,
    queueMaxReplicas: 2,
    logLevel: 'info',
    queueDockerfilePath: queueDockerfilePath
  },
  prod: {
    namespace: 'a0ec71-prod',
    name: `${name}`,
    queueName: `${queueName}`,
    dbName: `${dbName}`,
    phase: 'prod',
    changeId: deployChangeId,
    suffix: `-prod`,
    instance: `${name}-prod`,
    version: `${version}`,
    tag: `prod-${version}`,
    host: staticUrlsAPI.prod,
    appHost: staticUrls.prod,
    adminHost: 'https://loginproxy.gov.bc.ca/auth',
    env: 'prod',
    elasticsearchURL: 'http://es01:9200',
    elasticsearchEmlIndex: 'eml',
    s3KeyPrefix: 'platform',
    tz: config.timezone.api,
    sso: config.sso.prod,
    replicas: 2,
    maxReplicas: 2,
    queueReplicas: 2,
    queueMaxReplicas: 2,
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
