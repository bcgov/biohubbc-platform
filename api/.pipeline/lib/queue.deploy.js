'use strict';

const { OpenShiftClientX } = require('pipeline-cli');
const path = require('path');

/**
 * Run a pod to deploy the queue image (must be already built, see queue.build.js).
 *
 * @param {*} settings
 * @returns
 */
const queueDeploy = async (settings) => {
  const phases = settings.phases;
  const options = settings.options;
  const phase = options.env;

  const oc = new OpenShiftClientX(Object.assign({ namespace: phases[phase].namespace }, options));

  const templatesLocalBaseUrl = oc.toFileUrl(path.resolve(__dirname, '../templates'));

  const changeId = phases[phase].changeId;

  let objects = [];

  objects.push(
    ...oc.processDeploymentTemplate(`${templatesLocalBaseUrl}/queue.dc.yaml`, {
      param: {
        NAME: phases[phase].queueName,
        SUFFIX: phases[phase].suffix,
        VERSION: phases[phase].tag,
        CHANGE_ID: phases.build.changeId || changeId,
        DB_SERVICE_NAME: `${phases[phase].dbName}-postgresql${phases[phase].suffix}`,
        NODE_ENV: phases[phase].env || 'dev',
        S3_KEY_PREFIX: phases[phase].s3KeyPrefix,
        TZ: phases[phase].tz,
        KEYCLOAK_ADMIN_USERNAME: phases[phase].sso.adminUserName,
        KEYCLOAK_SECRET: phases[phase].sso.keycloakSecret,
        KEYCLOAK_SECRET_ADMIN_PASSWORD: phases[phase].sso.keycloakSecretAdminPassword,
        KEYCLOAK_HOST: phases[phase].sso.url,
        KEYCLOAK_CLIENT_ID: phases[phase].sso.clientId,
        KEYCLOAK_REALM: phases[phase].sso.realm,
        KEYCLOAK_INTEGRATION_ID: phases[phase].sso.integrationId,
        KEYCLOAK_ADMIN_HOST: phases[phase].sso.adminHost,
        KEYCLOAK_API_HOST: phases[phase].sso.apiHost,
        OBJECT_STORE_SECRETS: 'biohubbc-object-store',
        LOG_LEVEL: phases[phase].logLevel || 'info',
        REPLICAS: phases[phase].queueReplicas || 1,
        REPLICA_MAX: phases[phase].queueMaxReplicas || 1
      }
    })
  );

  oc.applyRecommendedLabels(objects, phases[phase].queueName, phase, `${changeId}`, phases[phase].instance);
  oc.importImageStreams(objects, phases[phase].tag, phases.build.namespace, phases.build.tag);

  oc.applyAndDeploy(objects, phases[phase].instance);
};

module.exports = { queueDeploy };
