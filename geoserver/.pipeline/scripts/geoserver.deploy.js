'use strict';

const { dbDeploy } = require('../lib/geoserver.deploy.js');
const config = require('../config.js');

const settings = { ...config, phase: config.options.env };

// deploying database
dbDeploy(settings);
