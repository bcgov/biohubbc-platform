'use strict';

const config = require('../config.js');
const { clean } = require('../lib/clean.js');

const settings = { ...config, phase: config.options.env };

clean(settings);
