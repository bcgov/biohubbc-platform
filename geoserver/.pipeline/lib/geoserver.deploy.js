'use strict';

const { OpenShiftClientX } = require('pipeline-cli');
const path = require('path');

/**
 * Run a pod to deploy the database image (must be already built, see geoserver.build.js).
 *
 * @param {*} settings
 * @returns
 */
const dbDeploy = (settings) => {
  const phases = settings.phases;
  const options = settings.options;
  const phase = options.env;

  const oc = new OpenShiftClientX(Object.assign({ namespace: phases[phase].namespace }, options));

  const templatesLocalBaseUrl = oc.toFileUrl(path.resolve(__dirname, '../templates'));

  const name = `${phases[phase].name}`;
  const instance = `${phases[phase].instance}`;
  const changeId = `${phases[phase].changeId}`;

  const objects = [];

  objects.push(
    ...oc.processDeploymentTemplate(`${templatesLocalBaseUrl}/geoserver.dc.yaml`, {
      param: {
        NAME: name,
        SUFFIX: phases[phase].suffix,
        // HOST: phases[phase].host,
        // GEOSERVER_SERVICE_NAME: `${name}-geoserver${phases[phase].suffix}`,
        IMAGE_STREAM_NAME: name,
        IMAGE_STREAM_VERSION: phases.build.tag,
        // IMAGE_STREAM_NAMESPACE: phases.build.namespace,
        // GEOSERVER_SECRETS_NAME: 'biohubbc-geoserver-credentials',
        // POSTGRESQL_DATABASE: 'biohubbc',
        // TZ: phases[phase].tz,
        VOLUME_CAPACITY: '3Gi'
      }
    })
  );

  oc.applyRecommendedLabels(objects, name, phase, changeId, instance);
  oc.importImageStreams(objects, phases[phase].tag, phases.build.namespace, phases.build.tag);
  oc.applyAndDeploy(objects, instance);
};

module.exports = { dbDeploy };
