'use strict';

const { queueBuild } = require('../lib/queue.build.js');
const config = require('../config.js');

const settings = { ...config, phase: 'build' };

// Builds the queue image
queueBuild(settings);
