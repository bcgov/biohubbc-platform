'use strict';
let options = require('pipeline-cli').Util.parseArguments();

// The root config for common values
const config = require('../../.config/config.json');

const name = config.module.app;
const apiName = config.module.api;

const changeId = options.pr || `${Math.floor(Date.now() * 1000) / 60.0}`; // aka pull-request or branch
const version = config.version || '1.0.0';

// A static deployment is when the deployment is updating dev, test, or prod (rather than a temporary PR)
const isStaticDeployment = options.type === 'static';

const deployChangeId = (isStaticDeployment && 'deploy') || changeId;
const branch = (isStaticDeployment && options.branch) || null;
const tag = (branch && `build-${version}-${changeId}-${branch}`) || `build-${version}-${changeId}`;

const staticUrls = config.staticUrls || {};
const staticUrlsAPI = config.staticUrlsAPI || {};
// const staticUrlsN8N = config.staticUrlsN8N || {};

const maxUploadNumFiles = 10;
const maxUploadFileSize = 52428800; // (bytes)

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
    phase: 'build',
    changeId: changeId,
    suffix: `-build-${changeId}`,
    instance: `${name}-build-${changeId}`,
    version: `${version}-${changeId}`,
    tag: tag,
    env: 'build',
    branch: branch
  },
  dev: {
    namespace: 'a0ec71-dev',
    name: `${name}`,
    phase: 'dev',
    changeId: deployChangeId,
    suffix: `-dev-${deployChangeId}`,
    instance: `${name}-dev-${deployChangeId}`,
    version: `${deployChangeId}-${changeId}`,
    tag: `dev-${version}-${deployChangeId}`,
    host:
      (isStaticDeployment && (staticUrls.dev)) ||
      `${name}-${changeId}-a0ec71-dev.apps.silver.devops.gov.bc.ca`,
    apiHost:
      (isStaticDeployment && (staticUrlsAPI.dev)) ||
      `${apiName}-${changeId}-a0ec71-dev.apps.silver.devops.gov.bc.ca`,
    n8nHost: '', // staticUrlsN8N.dev, // Disable until nginx is setup: https://quartech.atlassian.net/browse/BHBC-1435
    siteminderLogoutURL: config.siteminderLogoutURL.dev,
    maxUploadNumFiles,
    maxUploadFileSize,
    env: 'dev',
    sso: config.sso.dev,
    replicas: 1,
    maxReplicas: 2
  },
  test: {
    namespace: 'a0ec71-test',
    name: `${name}`,
    phase: 'test',
    changeId: deployChangeId,
    suffix: `-test`,
    instance: `${name}-test`,
    version: `${version}`,
    tag: `test-${version}`,
    host: staticUrls.test,
    apiHost: staticUrlsAPI.test,
    n8nHost: '', // staticUrlsN8N.test, // Disable until nginx is setup: https://quartech.atlassian.net/browse/BHBC-1435
    siteminderLogoutURL: config.siteminderLogoutURL.test,
    maxUploadNumFiles,
    maxUploadFileSize,
    env: 'test',
    sso: config.sso.test,
    replicas: 3,
    maxReplicas: 5
  },
  prod: {
    namespace: 'a0ec71-prod',
    name: `${name}`,
    phase: 'prod',
    changeId: deployChangeId,
    suffix: `-prod`,
    instance: `${name}-prod`,
    version: `${version}`,
    tag: `prod-${version}`,
    host: staticUrls.prod,
    apiHost: staticUrlsAPI.prod,
    n8nHost: '', // staticUrlsN8N.prod, // Disable until nginx is setup: https://quartech.atlassian.net/browse/BHBC-1435
    siteminderLogoutURL: config.siteminderLogoutURL.prod,
    maxUploadNumFiles,
    maxUploadFileSize,
    env: 'prod',
    sso: config.sso.prod,
    replicas: 3,
    maxReplicas: 6
  }
};

// This callback forces the node process to exit as failure.
process.on('unhandledRejection', (reason) => {
  console.log(reason);
  process.exit(1);
});

module.exports = exports = { phases, options };
