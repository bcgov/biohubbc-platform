/**
 * @description Check and delete existing resource
 */
const checkAndClean = (resourceName, oc) => {
  try {
    const list = oc.get(resourceName) || [];
    if (list.length === 0) {
      console.log(`checkAndClean: No resource available with resource name: ${resourceName}`);
    } else {
      console.log(`checkAndClean: Cleaning resource => ${resourceName}`);
      oc.delete([resourceName], { 'ignore-not-found': 'true', wait: 'true' });
    }
  } catch (excp) {
    console.error(`Resource ${resourceName} not available [${excp}]`);
  }
};

module.exports = { checkAndClean };
