'use strict';

const { OpenShiftClientX } = require('pipeline-cli');
const path = require('path');

/**
 * Run a pod to deploy the api image (must be already built, see api.build.js).
 *
 * @param {*} settings
 * @returns
 */
const apiDeploy = async (settings) => {
  const phases = settings.phases;
  const options = settings.options;
  const phase = options.env;

  const oc = new OpenShiftClientX(Object.assign({ namespace: phases[phase].namespace }, options));

  const templatesLocalBaseUrl = oc.toFileUrl(path.resolve(__dirname, '../templates'));

  const changeId = phases[phase].changeId;

  let objects = [];

  objects.push(
    ...oc.processDeploymentTemplate(`${templatesLocalBaseUrl}/api.dc.yaml`, {
      param: {
        NAME: phases[phase].name,
        SUFFIX: phases[phase].suffix,
        VERSION: phases[phase].tag,
        HOST: phases[phase].host,
        CHANGE_ID: phases.build.changeId || changeId,
        APP_HOST: phases[phase].appHost,
        NODE_ENV: phases[phase].env || 'dev',
        ELASTICSEARCH_URL: phases[phase].elasticsearchURL,
        ELASTICSEARCH_EML_INDEX: phases[phase].elasticsearchEmlIndex,
        S3_KEY_PREFIX: phases[phase].s3KeyPrefix,
        TZ: phases[phase].tz,
        KEYCLOAK_ADMIN_USERNAME: phases[phase].sso.adminUserName,
        KEYCLOAK_SECRET: phases[phase].sso.keycloakSecret,
        KEYCLOAK_SECRET_ADMIN_PASSWORD: phases[phase].sso.keycloakSecretAdminPassword,
        DB_SERVICE_NAME: `${phases[phase].dbName}-postgresql${phases[phase].suffix}`,
        KEYCLOAK_HOST: phases[phase].sso.url,
        KEYCLOAK_CLIENT_ID: phases[phase].sso.clientId,
        KEYCLOAK_REALM: phases[phase].sso.realm,
        KEYCLOAK_INTEGRATION_ID: phases[phase].sso.integrationId,
        KEYCLOAK_ADMIN_HOST: phases[phase].sso.adminHost,
        KEYCLOAK_API_HOST: phases[phase].sso.apiHost,
        LOG_LEVEL: phases[phase].logLevel || 'info',
        CPU_REQUEST: phases[phase].cpuRequest,
        CPU_LIMIT: phases[phase].cpuLimit,
        MEMORY_REQUEST: phases[phase].memoryRequest,
        MEMORY_LIMIT: phases[phase].memoryLimit,
        REPLICAS: phases[phase].replicas,
        REPLICAS_MAX: phases[phase].replicasMax
      }
    })
  );

  oc.applyRecommendedLabels(objects, phases[phase].name, phase, `${changeId}`, phases[phase].instance);
  oc.importImageStreams(objects, phases[phase].tag, phases.build.namespace, phases.build.tag);

  await oc.applyAndDeploy(objects, phases[phase].instance);
};

module.exports = { apiDeploy };
