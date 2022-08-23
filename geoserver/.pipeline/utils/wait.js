'use strict';

const { OpenShiftClientX } = require('pipeline-cli');

/**
 * Check that a given resource exists.
 *
 * @param {*} resourceName
 * @param {*} settings
 * @param {*} numberOfRetries How many times to check for the resource (defaults to 20)
 * @param {*} timeoutBetweenRetries How many seconds to wait between each check (defaults to 5)
 * @param {*} initialDelay How many seconds to wait before performing the first check (defaults to 0)
 */
const wait = (resourceName, settings, numberOfRetries, timeoutBetweenRetries, initialDelay) => {
  const phases = settings.phases;
  const options = settings.options;
  const phase = options.env;

  const oc = new OpenShiftClientX(Object.assign({ namespace: phases[phase].namespace }, options));

  const timeout = (timeoutBetweenRetries || 5) * 1000;
  let count = numberOfRetries || 20;
  const delay = (initialDelay || 0) * 1000;

  const check = () => {
    try {
      console.log(`1 Getting resource ${resourceName}`);
      const list = oc.get(resourceName) || [];
      // console.log(`${list.length}:${JSON.stringify(list, null, 2)}`)
      if (list.length === 0) {
        console.log(`1 Unable to fetch Database resource: ${resourceName}`);
        throw new Error(`1 Unable to fetch Database resource: ${resourceName}`);
      }
      // console.log(JSON.stringify(data, null, 2));
      // Get Status
      console.log(`2 Getting POD Status: ${resourceName}`);
      const data = list[0];
      const status = data.status || { conditions: [], containerStatuses: [] };
      if (status.conditions && status.conditions.length === 0) {
        console.log(`2 Unable to fetch Database resource: ${resourceName} status`);
        console.log(`2 ${JSON.stringify(data)}`);

        // Retry if count is not zero
        if (count > 0) {
          console.log(`3 Retry until count is 0: ${resourceName}`);
          count = count - 1;
          setTimeout(check, timeout);
        } else {
          throw new Error(`3 Unable to fetch Database resource: ${resourceName} status`);
        }
      }

      if (!status.containerStatuses) {
        console.log(`4 Unable to fetch Database resource: ${resourceName} container state (not defined)`);
        console.log(`4 ${JSON.stringify(data)}`);

        // Retry if count is not zero
        if (count > 0) {
          console.log(`5 Retry until count is 0: ${resourceName}`);
          count = count - 1;
          setTimeout(check, timeout);
          return;
        } else {
          throw new Error(`5 Unable to fetch Database resource: ${resourceName} status`);
        }
      }

      // Checking Container state
      if (status.containerStatuses && status.containerStatuses.length === 0) {
        console.log(`6 Unable to fetch Database resource: ${resourceName} container state`);
        console.log(`6 ${JSON.stringify(data)}`);

        // Retry if count is not zero
        if (count > 0) {
          console.log(`7 Retry until count is 0: ${resourceName}`);
          count = count - 1;
          setTimeout(check, timeout);
          return;
        } else {
          throw new Error(`7 Unable to fetch Database resource: ${resourceName} status`);
        }
      }

      console.log(`8 Checking Container State: ${resourceName}`);
      const containerStatus = status.containerStatuses[0] || {};
      if (!containerStatus.state) {
        console.log(`8 Unable to fetch Database resource: ${resourceName} container state`);
        console.log(`8 ${JSON.stringify(data)}`);
        throw new Error(`8 Unable to fetch Database resource: ${resourceName} container state`);
      }
      const state = containerStatus.state || {};
      if (state.terminated) {
        if (state.terminated.reason.toLowerCase() === 'completed') {
          console.log(`9 ${resourceName}: Finished [Successfully]`);
          // console.log(`${resourceName}: Deleting`)
          // Remove Pod
          // oc.delete([resourceName], {'ignore-not-found':'true', 'wait':'true'})
          return;
        } else {
          console.log(`9 Unable to fetch Database resource: ${resourceName} terminated with error`);
          console.log(JSON.stringify(data.status, null, 2));
          throw new Error(`9 Unable to fetch Database resource: ${resourceName} terminated with error`);
        }
      } else {
        if (count > 0) {
          console.log(`10 Waiting for resource: ${resourceName} to finish ... ${count}`);
          count = count - 1;
          setTimeout(check, timeout);
        } else {
          console.log(`10 Wait time exceed for resource: ${resourceName}`);
          console.log(`10 ${JSON.stringify(data)}`);
          throw new Error(`10 Wait time exceed for resource: ${resourceName}`);
        }
      }
    } catch (excp) {
      console.error(`11 Pod (${resourceName}) Wait: Exception  ${excp}`);
      throw excp;
    }
  };

  // Initial execution after `delay` milliseconds
  setTimeout(check, delay);
};

module.exports = { wait };
