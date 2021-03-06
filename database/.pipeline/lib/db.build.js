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
    ...oc.processDeploymentTemplate(`${templatesLocalBaseUrl}/db.bc.yaml`, {
      param: {
        NAME: name,
        SUFFIX: `${phases[phase].suffix}`,
        TAG_NAME: `${phases[phase].tag}`
      }
    })
  );

  oc.applyRecommendedLabels(objects, name, phase, phases[phase].changeId, phases[phase].instance);
  oc.applyAndBuild(objects);
};

module.exports = { dbBuild };
