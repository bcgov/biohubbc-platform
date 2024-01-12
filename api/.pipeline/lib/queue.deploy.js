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
        NAME: phases[phase].name,
        SUFFIX: phases[phase].suffix,
        VERSION: phases[phase].tag,
        HOST: phases[phase].host,
        CHANGE_ID: phases.build.changeId || changeId,
        APP_HOST: phases[phase].appHost,
        // Node
        NODE_ENV: phases[phase].env || 'dev',
        // Elastic Search
        ELASTICSEARCH_URL: phases[phase].elasticsearchURL,
        ELASTICSEARCH_EML_INDEX: phases[phase].elasticsearchEmlIndex,
        ELASTICSEARCH_TAXONOMY_INDEX: phases[phase].elasticsearchTaxonomyIndex,
        // S3 (Object Store)
        S3_KEY_PREFIX: phases[phase].s3KeyPrefix,
        OBJECT_STORE_SECRETS: 'biohubbc-object-store',
        // Database
        TZ: phases[phase].tz,
        DB_SERVICE_NAME: `${phases[phase].dbName}-postgresql${phases[phase].suffix}`,
        // Log Level
        LOG_LEVEL: phases[phase].logLevel || 'info',
        // Openshift Resources
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

module.exports = { queueDeploy };
