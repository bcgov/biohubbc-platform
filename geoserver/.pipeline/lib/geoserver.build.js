'use strict';

const { OpenShiftClientX } = require('pipeline-cli');
const path = require('path');

/**
 * Run a pod to build the database image stream.
 *
 * @param {*} settings
 */
const dbBuild = (settings) => {
  const phases = settings.phases;
  const options = settings.options;
  const phase = 'build';

  const oc = new OpenShiftClientX(Object.assign({ namespace: phases[phase].namespace }, options));

  const templatesLocalBaseUrl = oc.toFileUrl(path.resolve(__dirname, '../templates'));

  const name = `${phases[phase].name}`;

  const objects = [];

  objects.push(
    ...oc.processDeploymentTemplate(`${templatesLocalBaseUrl}/geoserver.bc.yaml`, {
      param: {
        NAME: name,
        SUFFIX: `${phases[phase].suffix}`,
        TARGET_IMAGE_VERSION: `${phases[phase].tag}`,
        SOURCE_IMAGE_NAME: 'kartoza-geoserver',
        SOURCE_IMAGE_VERSION: '2.21.1'
        // GIT_REPO_URL: oc.git.http_url,
        // GIT_REF: phases[phase].branch || oc.git.ref,
        // SOURCE_CONTEXT_DIR: 'geoserver/biohub-geoserver',
        // DOCKERFILE_PATH: 'Dockerfile'
      }
    })
  );

  oc.applyRecommendedLabels(objects, name, phase, phases[phase].changeId, phases[phase].instance);
  oc.applyAndBuild(objects);
};

module.exports = { dbBuild };
