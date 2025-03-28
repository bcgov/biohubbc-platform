'use strict';

const { queueDeploy } = require('../lib/queue.deploy.js');
const config = require('../queue.config.js');

const settings = { ...config, phase: config.options.phase };

process.on('unhandledRejection', (reason, promise) => {
  console.log('queue deploy - unhandled rejection:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('exit', (code) => {
  console.log('queue deploy - exit:', 'code:', code);
});

// Deploys the queue image
queueDeploy(settings).catch((error) => {
  console.log('queue deploy - catch - error: ', error);
  throw error;
});
