'use strict';

const { OpenShiftClientX } = require('pipeline-cli');
const path = require('path');
const { checkAndClean } = require('../utils/checkAndClean');

const dbSetupDeploy = (settings) => {
  const phases = settings.phases;
  const options = settings.options;
  const phase = options.env;

  const oc = new OpenShiftClientX(Object.assign({ namespace: phases[phase].namespace }, options));

  const templatesLocalBaseUrl = oc.toFileUrl(path.resolve(__dirname, '../templates'));

  const changeId = phases[phase].changeId;
  const isName = `${phases[phase].name}-setup`;
  const instance = `${isName}-${changeId}`;
  const isVersion = `${phases[phase].tag}-setup`;
  const imageStreamName = `${isName}:${isVersion}`;

  const objects = [];
  const imageStreamObjects = [];

  // Clean existing image
  checkAndClean(`istag/${imageStreamName}`, oc);

  // Creating image stream for setup
  imageStreamObjects.push(
    ...oc.processDeploymentTemplate(`${templatesLocalBaseUrl}/db.setup.is.yaml`, {
      param: {
        NAME: `${isName}`
      }
    })
  );

  oc.applyRecommendedLabels(imageStreamObjects, isName, phase, `${changeId}`, instance);
  oc.importImageStreams(imageStreamObjects, isVersion, phases.build.namespace, phases.build.tag);

  // Get database setup image stream
  const fetchedImageStreams = oc.get(`istag/${imageStreamName}`) || [];

  if (!fetchedImageStreams.length) {
    console.log('Unable to fetch Database image reference for use in database setup deployment');
    process.exit(0);
  }

  const dbSetupImageStream = fetchedImageStreams[0];

  const name = `${isName}${phases[phase].suffix}`;

  objects.push(
    ...oc.processDeploymentTemplate(`${templatesLocalBaseUrl}/db.setup.dc.yaml`, {
      param: {
        NAME: name,
        SUFFIX: phases[phase].suffix,
        VERSION: phases[phase].tag,
        CHANGE_ID: changeId,
        NODE_ENV: phases[phase].env || 'dev',
        DB_SERVICE_NAME: `${phases[phase].name}-postgresql${phases[phase].suffix}`,
        DB_SCHEMA: 'biohub',
        DB_SCHEMA_DAPI_V1: 'biohub_dapi_v1',
        IMAGE: dbSetupImageStream.image.dockerImageReference
      }
    })
  );

  checkAndClean(`pod/${name}`, oc);

  oc.applyRecommendedLabels(objects, isName, phase, `${changeId}`, instance);
  oc.applyAndDeploy(objects, phases[phase].instance);
};

module.exports = { dbSetupDeploy };
